import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
//Para Post Procesado
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
//Los Shaders del post procesado y los del rasengan
import vertexShader from './shaders/vertex.glsl?raw';
import fragmentShader from './shaders/fragment.glsl?raw';
import ppVertexShader from './shaders/pp_vertex.glsl?raw';
import ppFragmentMotionBlur from './shaders/pp_frag_motionblur.glsl?raw';

//Donde se cargara el shader
interface ShaderDefinition {
    uniforms: Record<string, { value: any }>;
    vertexShader: string;
    fragmentShader: string;
}
//Para actualizar el efecto del shader
interface Effect {
    pass: ShaderPass;
    name: string;
    enabled: boolean;
    params?: Record<string, any>;
}

//Unico shader(Se uso la plantilla y por eso quedo asi)
const motionBlurShader: ShaderDefinition = {
    uniforms: {
        tDiffuse: { value: null },
        uVelocity: { value: new THREE.Vector2(0, 0) },
        uStrength: { value: 0.1 },
    },
    vertexShader: ppVertexShader,
    fragmentShader: ppFragmentMotionBlur,
};

class App {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private startTime: number;

    private geometry: THREE.BufferGeometry;
    private material: THREE.RawShaderMaterial;
    private points: THREE.Points;
    private gui: GUI;


    private composer: EffectComposer;
    private effects: Map<string, Effect> = new Map();
    private prevCameraMatrix = new THREE.Matrix4();
    private currentVelocity = new THREE.Vector2(0, 0);
    //Parametros del Motion Blur
    private mbParams = {
        strength: 0.025,
        minThreshold: 0.0001 
    };
    //Parametros del Rasengan
    private params = {  
        noiseVisible: true,
        noiseSpeed: 0.5,
        spiralVisible: true,
        spiralSpeed: 4.0,
        chakraVisible: true,
        chakraSpeed: 4.0,
        chakraFlow: 0.15,
        pointSize: 8.0,
        color: '#44aaff',
        density: 1000000 
    };

    constructor() {
        this.startTime = Date.now();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance',
        });
        if (!this.renderer.capabilities.isWebGL2) {
            console.warn('WebGL 2.0 is not available on this browser.');
        }

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        this.animate = this.animate.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);

        //Shader del Rasengan
        const count = this.params.density;
        this.geometry = new THREE.BufferGeometry();
        const pIds = new Float32Array(count);
        const pOffsets = new Float32Array(count);
        const pTypes = new Float32Array(count); 

        for (let i = 0; i < count; i++) {
            pIds[i] = i % 20; 
            pOffsets[i] = Math.random();
            const rand = Math.random();
            if (rand < 0.3) pTypes[i] = 0.0; 
            else if (rand < 0.5) pTypes[i] = 1.0; 
            else pTypes[i] = 2.0; 
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        this.geometry.setAttribute('aId', new THREE.BufferAttribute(pIds, 1));
        this.geometry.setAttribute('aOffset', new THREE.BufferAttribute(pOffsets, 1));
        this.geometry.setAttribute('aType', new THREE.BufferAttribute(pTypes, 1));

        
        this.material = new THREE.RawShaderMaterial({
            vertexShader,
            fragmentShader,
            glslVersion: THREE.GLSL3,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            uniforms: {
                u_time: { value: 0.0 },
                u_pointSize: { value: this.params.pointSize },
                u_color: { value: new THREE.Color(this.params.color) },
                u_noiseSpeed: { value: this.params.noiseSpeed },
                u_spiralSpeed: { value: this.params.spiralSpeed },
                u_chakraSpeed: { value: this.params.chakraSpeed },
                u_chakraFlow: { value: this.params.chakraFlow },
                u_showNoise: { value: 1.0 },
                u_showSpiral: { value: 1.0 },
                u_showChakra: { value: 1.0 },
                projectionMatrix: { value: this.camera.projectionMatrix },
                viewMatrix: { value: this.camera.matrixWorldInverse },
                modelMatrix: { value: new THREE.Matrix4() },
            }
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);

        //Iniciamos el Post Procesados
        this.setupPostProcessing();
        this.prevCameraMatrix.copy(this.camera.matrixWorld);

        this.gui = new GUI({ title: 'Rasengan: Post-Procesado' });
        this.setupUI();
        
        window.addEventListener('resize', this.onWindowResize);
        this.animate();
    }
    //Llamamos al Composser y agregamos el efecto del motion blur 
    private setupPostProcessing(): void {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.addEffect('motionBlur', motionBlurShader, { uStrength: this.mbParams.strength }, true);
    }

    //Cargamos el vertex Shader en Shader Pass
    public addEffect(name: string, shaderDef: ShaderDefinition, params?: any, enabled = false): void {
        const material = new THREE.RawShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(shaderDef.uniforms),
            vertexShader: shaderDef.vertexShader,
            fragmentShader: shaderDef.fragmentShader,
            glslVersion: THREE.GLSL3,
        });
        const pass = new ShaderPass(material);
        //Para manejar los parametros del shader
        pass.enabled = enabled;
        if (params) {
            Object.entries(params).forEach(([k, v]) => { if (pass.uniforms[k]) pass.uniforms[k].value = v; });
        }
        this.composer.addPass(pass);
        this.effects.set(name, { pass, name, enabled, params });
    }
    //Actualiza los efecto del shader cada vez que se cambia los paramatros en el gui
    public updateEffectParam(name: string, paramName: string, value: any): void {
        const effect = this.effects.get(name);
        if (effect && effect.pass.uniforms[paramName]) {
            effect.pass.uniforms[paramName].value = value;
        }
    }

    private setupUI() {
        
        const mbFolder = this.gui.addFolder('Post-Procesado: Motion Blur');
        mbFolder.add(this.mbParams, 'strength', 0, 1).name('Fuerza').onChange(v => this.updateEffectParam('motionBlur', 'uStrength', v));
        mbFolder.add(this.mbParams, 'minThreshold', 0, 0.01).name('Sensibilidad');

        mbFolder.open();
    }

    private animate(): void {
        requestAnimationFrame(this.animate);
        const elapsedTime = (Date.now() - this.startTime) / 1000;
        
        //Logica de Motion Blur(Simple)
        //Tomamos el anterior frame y el actual para calcular una velocidad
        //Esta velocidad se usara para definir el blur en el fragment
        this.camera.updateMatrixWorld();
        const currentPos = new THREE.Vector3().setFromMatrixPosition(this.camera.matrixWorld);
        const prevPos = new THREE.Vector3().setFromMatrixPosition(this.prevCameraMatrix);
        const deltaMove = new THREE.Vector3().subVectors(currentPos, prevPos);
        const speed = deltaMove.length();
        //Detalles extra para hacer el motion blur un poco menos rudo
        if (speed > this.mbParams.minThreshold) {
            this.currentVelocity.set(deltaMove.x * 10.0, deltaMove.y * 10.0); // Multiplicador para notar el efecto
        } else {
            this.currentVelocity.lerp(new THREE.Vector2(0, 0), 0.1); // Frenado suave
        }

        this.updateEffectParam('motionBlur', 'uVelocity', this.currentVelocity);
        this.prevCameraMatrix.copy(this.camera.matrixWorld);

        
        this.material.uniforms.u_time.value = elapsedTime;
        this.points.updateMatrixWorld();
        this.material.uniforms.modelMatrix.value.copy(this.points.matrixWorld);
        this.material.uniforms.viewMatrix.value.copy(this.camera.matrixWorldInverse);

        this.controls.update();
        this.composer.render();
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.material.uniforms.projectionMatrix.value.copy(this.camera.projectionMatrix);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }
}

new App();
