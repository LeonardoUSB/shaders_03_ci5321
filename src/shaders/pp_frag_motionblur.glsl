precision highp float;

uniform sampler2D tDiffuse;
uniform vec2 uVelocity;
uniform float uStrength;

in vec2 vUv;

out vec4 pc_fragColor;

void main() { 
    const int SAMPLES = 20;
    vec4 color = vec4(0.0); 
    for(int i = 0; i < SAMPLES; i++) {

        float offset = float(i) / float(SAMPLES - 1);
        color += texture(tDiffuse, vUv + (uVelocity * uStrength * offset));
    }
    
    
    pc_fragColor = color / float(SAMPLES);
}
