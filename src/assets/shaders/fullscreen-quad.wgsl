// Uniforms : données envoyées depuis TypeScript chaque frame
@group(0) @binding(0) var<uniform> time: f32;

// Structure de sortie du vertex shader
// On transmet la position ET les coordonnées UV au fragment shader
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    // 6 sommets = 2 triangles = 1 rectangle couvrant tout l'écran
    // En coordonnées NDC : de (-1,-1) à (1,1)
    var positions = array<vec2f, 6>(
        vec2f(-1.0, -1.0),   // Triangle 1 : bas-gauche
        vec2f( 1.0, -1.0),   //              bas-droite
        vec2f(-1.0,  1.0),   //              haut-gauche
        vec2f(-1.0,  1.0),   // Triangle 2 : haut-gauche
        vec2f( 1.0, -1.0),   //              bas-droite
        vec2f( 1.0,  1.0),   //              haut-droite
    );

    var output: VertexOutput;
    output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
    // Convertir NDC (-1,+1) en UV (0,1)
    output.uv = (positions[vertexIndex] + 1.0) / 2.0;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    // Dégradé de vérification :
    // Rouge = axe horizontal (gauche→droite)
    // Vert = axe vertical (bas→haut)
    // Bleu = pulse lent avec le temps (prouve que les uniforms fonctionnent)
    let blue = 0.1 + 0.1 * sin(time);
    return vec4f(input.uv, blue, 1.0);
}
