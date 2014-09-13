
function NoiseGenerator(game) {
    this.game = game;

    this.dirtyNoise2 = function( x,y,z )
    {
        function hash( n )
        {
            return ($.s(n)*43758.5453)%1;
        };
        function mix(s,f,v)
        {
            return s + (f-s)*v;
        };

        var p = vec3.create([$._(x),$._(y),$._(z)]);
        var f = vec3.create([x%1,y%1,z%1]);

        for(var i=0;i<3;i++)
            f[i] = f[i]*f[i]*(3.0-2.0*f[i]);

        var n = p[0] + p[1]*57.0 + 113.0*p[2];
        return mix(mix(mix( hash(n+  0.0), hash(n+  1.0),f[0]),
                mix( hash(n+ 57.0), hash(n+ 58.0),f[0]),f[1]),
            mix(mix( hash(n+113.0), hash(n+114.0),f[0]),
                mix( hash(n+170.0), hash(n+171.0),f[0]),f[1]),f[2]);
    };

    this.random = function( x,y,z )
    {
        return $.r();
    };

};