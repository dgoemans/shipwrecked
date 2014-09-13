function GeometryGenerator(game)
{
    this.game = game;

    this.quad = function(w,h,pX,pY)
    {
        return this.cube(w,h,0,pX,pY,0,true);
    }

    this.cube = function(w,h,d, pivotX, pivotY, pivotZ, q)
    {
        var vertices = [
                -w * (pivotX),  -h * (pivotY),  d*(1-pivotZ),
                w * (1-pivotX),  -h * (pivotY),  d*(1-pivotZ),
                -w * (pivotX),  h * (1- pivotY),  d*(1-pivotZ),
                w * (1-pivotX),  h * (1-pivotY),  d*(1-pivotZ),

                -w * (pivotX),  -h * (pivotY),  -d*pivotZ,
                w * (1-pivotX),  -h * (pivotY),  -d*pivotZ,
                -w * (pivotX),  h * (1- pivotY),  -d*pivotZ,
                w * (1-pivotX),  h * (1-pivotY),  -d*pivotZ,

                -w * (pivotX),  h * (1-pivotY),  -d*pivotZ,
                w * (1-pivotX),  h * (1-pivotY),  -d*pivotZ,
                -w * (pivotX),  h * (1- pivotY),  d*(1-pivotZ),
                w * (1-pivotX),  h * (1-pivotY),  d*(1-pivotZ),

                -w * (pivotX),  -h * (pivotY),  -d*pivotZ,
                w * (1-pivotX),  -h * (pivotY),  -d*pivotZ,
                -w * (pivotX),  -h * (pivotY),  d*(1-pivotZ),
                w * (1-pivotX),  -h * (pivotY),  d*(1-pivotZ),

                w * (1-pivotX),  -h * (pivotY),  -d*pivotZ,
                w * (1-pivotX),  h * (1-pivotY),  -d*pivotZ,
                w * (1-pivotX),  -h * (pivotY),  d*(1-pivotZ),
                w * (1-pivotX),  h * (1-pivotY),  d*(1-pivotZ),

                -w * (pivotX),  -h * (pivotY),  -d*pivotZ,
                -w * (pivotX),  h * (1-pivotY),  -d*pivotZ,
                -w * (pivotX),  -h * (pivotY),  d*(1-pivotZ),
                -w * (pivotX),  h * (1-pivotY),  d*(1-pivotZ)
        ];

        var uvs = [];
        var i;
        for(i=0;i<48;i+=8)
        {
            uvs[i]=uvs[i+1]=uvs[i+3]=uvs[i+4]=0;
            uvs[i+2]=uvs[i+5]=uvs[i+6]=uvs[i+7]=1;
        }

        var indices = [
            0, 1, 2,
            2, 1, 3,

            4, 5, 6,
            6, 5, 7,

            8, 9, 10,
            10, 9, 11,

            12, 13, 14,
            14, 13, 15,

            16, 17, 18,
            18, 17, 19,

            20, 21, 22,
            22, 21, 23
        ];

        var normals = [
            0,0, 1,
            0,0, 1,
            0,0, 1,
            0,0, 1,

            0,0, -1,
            0,0, -1,
            0,0, -1,
            0,0, -1,

            0,1, 0,
            0,1, 0,
            0,1, 0,
            0,1, 0,

            0,-1, 0,
            0,-1, 0,
            0,-1, 0,
            0,-1, 0,

            1,0, 0,
            1,0, 0,
            1,0, 0,
            1,0, 0,

            -1,0, 0,
            -1,0, 0,
            -1,0, 0,
            -1,0, 0
        ];

        if(q)
        {
            vertices.length = normals.length = 12;
            indices.length = 6;
            uvs.length = 8;
        }

        return { vertices : vertices, normals: normals, indices: indices, uvs: uvs, dataType : gl.TRIANGLES };
    };

    this.rock  = function(radius, sizeVariance, roughness)
    {
        radius = radius || 1;
        sizeVariance = (sizeVariance !== undefined) ? sizeVariance : 0.8;
        roughness = (roughness !== undefined) ? roughness : 0.02;

        var d1 = (1-sizeVariance) + sizeVariance*$.r();
        var d2 = (1-sizeVariance) + sizeVariance*$.r();
        var d3 = (1-sizeVariance) + sizeVariance*$.r();

        var bands = 16;

        var vertexPositionData = [];
        var normalData = [];
        var textureCoordData = [];
        for (var latNumber = 0; latNumber <= bands; latNumber++) {
            var theta = latNumber * $.PI / bands;
            var sinTheta = $.s(theta);
            var cosTheta = $.c(theta);

            for (var longNumber = 0; longNumber <= bands; longNumber++) {
                var phi = longNumber * 2 * $.PI / bands;
                var sinPhi = $.s(phi);
                var cosPhi = $.c(phi);

                var x = cosPhi * sinTheta * d1;
                var y = cosTheta * d2;
                var z = sinPhi * sinTheta * d3;
                var u = 1 - (longNumber / bands);
                var v = 1 - (latNumber / bands);

                normalData.push(x);
                normalData.push(y);
                normalData.push(z);
                textureCoordData.push(u);
                textureCoordData.push(v);

                var lat = latNumber%bands;
                var lon = longNumber%bands;
                if(lat === 0)
                    lon = 0;

                var r1 = radius + radius*this.game.noiseGen.dirtyNoise2(lat,lon,0)*roughness
                var r2 = radius + radius*this.game.noiseGen.dirtyNoise2(lat,lon,1)*roughness
                var r3 = radius + radius*this.game.noiseGen.dirtyNoise2(lat,lon,2)*roughness


                vertexPositionData.push(r1 * x);
                vertexPositionData.push(r2 * y);
                vertexPositionData.push(r3 * z);
            }
        }

        var indexData = [];
        for (var latNumber = 0; latNumber < bands; latNumber++) {
            for (var longNumber = 0; longNumber < bands; longNumber++) {
                var first = (latNumber * (bands + 1)) + longNumber;
                var second = first + bands + 1;
                indexData.push(first);
                indexData.push(second);
                indexData.push(first + 1);

                indexData.push(second);
                indexData.push(second + 1);
                indexData.push(first + 1);
            }
        }

        return { vertices: vertexPositionData, normals: normalData, uvs: textureCoordData, indices: indexData, dataType : gl.TRIANGLES };
    }


};