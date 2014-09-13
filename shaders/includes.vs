@ vec3 aVN;
@ vec2 aTex;
@ vec3 aV;
@ vec4 aVTn;

# mat4 uMV;
# mat4 uP;
# mat3 uN;
# mat4 uM;

# float uT;
# float uS;
# vec3 uA;
# vec3 uL;
# vec3 uD;
# vec3 uE;


$ vec2 vT; // Tex
$ vec3 vL; // Light
$ vec4 vA; // Amb
$ vec4 vD; // Dir
$ vec3 vN; // Normal
$ vec3 vV; // View
$ vec3 vG; // Tan
$ vec3 vB; // Binormal
$ float vX; // Time

void main(void)
{
    gl_Position = uP * uMV * vec4(aV, 1.0);
    vT = aTex;
    vN = normalize(uN * aVN);
    vL = uL;
    vA = vec4(uA.rgb, 1.);
    vD = vec4(uD.rgb, 1.);

    vG = normalize(uN * aVTn.xyz);
    vec3 bn = cross (aVN, aVTn.xyz) * aVTn.w;
    vB = normalize(uN * bn);

    vX = uT;

    vec4 vp = uM * vec4(aV, 1.0);
    vV = normalize(vec4(uE,1.0) - vp).xyz;
}

