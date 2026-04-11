

in float aId; 
in float aOffset; 
in float aType; 

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float u_time;
uniform float u_pointSize;

uniform float u_noiseSpeed;     // Velocidad del enjambre
uniform float u_spiralSpeed;    // Vueltas de la viajera
uniform float u_chakraSpeed;    // Vueltas del sistema interno
uniform float u_chakraFlow;


uniform float u_showNoise;      // Toggle 0.0 o 1.0
uniform float u_showSpiral;     // Toggle 0.0 o 1.0
uniform float u_showChakra;

// --- Funciones de Apoyo ---

float hash(vec3 p) {
    p  = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

vec3 randomSpherePoint(vec3 seed) {
    float u = hash(seed);
    float v = hash(seed + 123.45);
    float theta = u * 6.283185;
    float phi = acos(2.0 * v - 1.0);
    return vec3(sin(phi) * cos(theta), sin(phi) * sin(theta), cos(phi));
}

vec3 rotateVector(vec3 v, float angleY, float angleZ) {
    float sY = sin(angleY); float cY = cos(angleY);
    v = vec3(v.x * cY + v.z * sY, v.y, -v.x * sY + v.z * cY);
    float sZ = sin(angleZ); float cZ = cos(angleZ);
    v = vec3(v.x * cZ - v.y * sZ, v.x * sZ + v.y * cZ, v.z);
    return v;
}

vec3 alignToVector(vec3 v, vec3 target) {
    vec3 t = normalize(target);
    vec3 up = abs(t.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(up, t));
    vec3 actualUp = cross(t, right);
    return v.x * right + v.y * actualUp + v.z * t;
}

void main() {
    float PI = 3.14159265;
    vec3 finalPos;
    float finalAlpha = 1.0;
    int id = int(aId);

    // Shader de Ruido 
    if (aType < 0.5) {
        if (u_showNoise > 0.5) {
            vec3 seed = vec3(aId, aOffset, 0.0);
            vec3 pos = randomSpherePoint(seed);
            float noise = hash(pos + u_time * u_noiseSpeed);
            finalPos = normalize(pos + (noise - 0.5) ) * 2.0;
            finalAlpha = hash(seed + 50.0);
        }
    }
    
    // Shader de Giro
    else if (aType < 1.5) {
        if (u_showSpiral > 0.5) {
            float progress = mod(u_time + aOffset, 1.0);
            vec3 targetDir;
            // Simplificación de selección de eje
            switch(id % 10) {
                case 0: targetDir = vec3(1,0,0); break; case 1: targetDir = vec3(0,1,0); break;
                case 2: targetDir = vec3(0,0,1); break; case 3: targetDir = vec3(-1,0,0); break;
                case 4: targetDir = vec3(0,-1,0); break; case 5: targetDir = vec3(0,0,-1); break;
                case 6: targetDir = vec3(1,1,1); break; case 7: targetDir = vec3(-1,1,1); break;
                case 8: targetDir = vec3(1,-1,1); break; case 9: targetDir = vec3(1,1,-1); break;
            }
            vec3 rotatedTarget = rotateVector(targetDir, u_time * (0.3 + (aId * 0.05)), u_time * 0.2);
            float R = 2.0;
            float travelZ = R * cos(progress * PI); 
            float spiralAmp = R * sin(progress * PI);
            float angle = progress * u_spiralSpeed * PI * 2.0;
            vec3 localPos = vec3(cos(angle) * spiralAmp, sin(angle) * spiralAmp, travelZ);
            finalPos = alignToVector(localPos, rotatedTarget);
            finalAlpha = sin(progress * PI);
        }
    }

    // Shader de Chakra
    else {
        if (u_showChakra > 0.5) {
            float progress = mod(u_time * (u_chakraFlow * 0.4) + aOffset, 1.0);
            
            // Radio que se encoge hacia el centro
            float rBase = 1.8 * (1.0 - progress); 
            
            //Estiramos un poco los hilos de chakra
            float stretch = 2.0;
            
            float angle = (progress * 6.2831) * u_chakraSpeed; 
            float s = sin(angle) * rBase; 
            float c = cos(angle) * rBase;
            
            vec3 newPos;
            
            switch(id % 20) {
                // PLANO XZ
                case 0:  newPos = vec3(c * stretch, 0.0, s); break;
                case 1:  newPos = vec3(-c * stretch, 0.0, -s); break;
                case 2:  newPos = vec3(-s, 0.0, c * stretch); break;
                case 3:  newPos = vec3(s, 0.0, -c * stretch); break;
                // PLANO YZ
                case 4:  newPos = vec3(0.0, c * stretch, s); break;
                case 5:  newPos = vec3(0.0, -c * stretch, -s); break;
                case 6:  newPos = vec3(0.0, -s, c * stretch); break;
                case 7:  newPos = vec3(0.0, s, -c * stretch); break;
                // PLANO XY
                case 8:  newPos = vec3(c * stretch, s, 0.0); break;
                case 9:  newPos = vec3(-c * stretch, -s, 0.0); break;
                case 10: newPos = vec3(-s, c * stretch, 0.0); break;
                case 11: newPos = vec3(s, -c * stretch, 0.0); break;
                // DIAGONAL A
                case 12: newPos = vec3(c * stretch, s, c); break;
                case 13: newPos = vec3(-c * stretch, -s, -c); break;
                case 14: newPos = vec3(-s, c * stretch, -s); break;
                case 15: newPos = vec3(s, -c * stretch, s); break;
                // DIAGONAL B
                case 16: newPos = vec3(c * stretch, s, -c); break;
                case 17: newPos = vec3(-c * stretch, -s, c); break;
                case 18: newPos = vec3(-s, c * stretch, s); break;
                case 19: newPos = vec3(s, -c * stretch, -s); break;
                default: newPos = vec3(0.0); break;
            }
        
            finalPos = newPos;
            // Brillo que desaparece al llegar al centro
            finalAlpha = sin(progress * PI) * 0.7;
        }
    }

    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(finalPos, 1.0);
    gl_PointSize = u_pointSize * finalAlpha * (1.0 / gl_Position.w);
}
