
precision highp float;

uniform vec3 u_color;
out vec4 fragColor;

void main() {
    vec2 uv = gl_PointCoord;
    float dist = distance(uv, vec2(0.5));
    float strength = 0.05 / dist;
    strength = pow(strength, 2.0); 
    float alpha = smoothstep(0.5, 0.1, dist);
    if (alpha < 0.1) discard;
    // Mezclamos el color base con blanco en el centro (donde strength es alto)
    // para simular la saturación de energía del Rasengan
    vec3 finalColor = mix(u_color, vec3(1.0), strength * 0.5);
    fragColor = vec4(finalColor, alpha * 0.6);
}
