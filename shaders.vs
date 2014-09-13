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

