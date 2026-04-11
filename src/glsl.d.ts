// Este archivo le dice a TypeScript: 
// "Cualquier cosa que termine en .glsl o .frag tratao como un string (texto)"

declare module '*.glsl' {
  const value: string;
  export default value;
}

declare module '*.frag' {
  const value: string;
  export default value;
}

declare module '*.vert' {
  const value: string;
  export default value;
}
