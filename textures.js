function TextureGenerator(game) {
    this.game = game;


    this.createNoiseBumpMap = function (f, a, func, baseColor, varColor,size) {
        baseColor = baseColor || 180;
        varColor = varColor || 75;
        f = f || 5;
        a = a || 1;
        func = func || this.game.noiseGen.random;
        size = size || 256;

        var array = this.createData(size,function(x,y){
            var f = 25;
            var value = $.a(func(x / size * f, y / size * f, 0) * a);
            value = $.clamp(value, 0, 1);
            return [baseColor + varColor * value,baseColor + varColor * value,baseColor + varColor * value,255];
        });

        array = this.normal_from_height(array, size);

        var pixels = new Uint8Array(array);
        return this.data(pixels, size, size);
    };

    this.createCloudTexture = function (rVar, gVar, bVar, aVar) {
        rVar = rVar || 255;
        gVar = gVar || 255;
        bVar = bVar || 255;
        aVar = aVar || 0;

        var noiseGen = this.game.noiseGen;
        var size = 128;

        var heightMap = this.game.terrainGen.generateHeightmap(size,size,20,1,32,52,126,0);

        var array = this.createData(size,function(x,y){
            var value = heightMap[y][x];
            value = (2 * value * value * $.s(x / size * $.PI) * $.s(y / size * $.PI));
            value = $.clamp(value, 0,1);
            return [rVar + (255 - rVar) * value, gVar + (255 - gVar) * value, bVar + (255 - bVar) * value, aVar + (255 - aVar) * value];
        });

        var pixels = new Uint8Array(array);
        return this.data(pixels, size, size);
    };

    this.createData = function(size, pixelCallback)
    {
        var array = new Array(4 * size * size);
        var i = 0;
        for (var y = 0; y < size; y++) {
            for (var x = 0; x < size; x++)
            {
                var value = pixelCallback(x,y);
                for(var j=0; j<value.length;j++)
                    array[i++] = value[j];
            }
        }

        return array;
    };

    this.createColorTexture = function (r, g, b) {
        var pixels = new Uint8Array([r, g, b,
            r, g, b,
            r, g, b,
            r, g, b]);
        return this.data(pixels, 2, 2, gl.RGB);
    };


    this.createCubeMap = function (rVar,gVar,bVar,aVar) {

        var format = gl.RGBA;
        var posX, negX, posY, negY, posZ, negZ;
        var size = 256;

        var heightMap = this.game.terrainGen.generateHeightmap(size,size,5,1,32,52,126,0);

        var array = this.createData(size,function(x,y){
            var value = heightMap[y][x];
            value = $.clamp(value, 0,1);
            return [rVar + (255 - rVar) * value, gVar + (255 - gVar) * value, bVar + (255 - bVar) * value, aVar + (255 - aVar) * value];
        });

        var cloud = new Uint8Array(array);
        posX = negX = posY = negY = posZ = negZ = cloud;

        var texture = gl.createTexture();
        gl.bindTexture(gl[$.cubeMapVar], texture);
        gl.texParameteri(gl[$.cubeMapVar], gl[$.wrapSVar], gl[$.clampVar]);
        gl.texParameteri(gl[$.cubeMapVar], gl[$.wrapTVar], gl[$.clampVar]);
        gl.texParameteri(gl[$.cubeMapVar], gl[$.minFilterVar], gl[$.linearVar]);
        gl.texParameteri(gl[$.cubeMapVar], gl[$.magFilterVar], gl[$.linearVar]);

        var faces = [
            [posX, gl.TEXTURE_CUBE_MAP_POSITIVE_X],
            [negX, gl.TEXTURE_CUBE_MAP_NEGATIVE_X],
            [posY, gl.TEXTURE_CUBE_MAP_POSITIVE_Y],
            [negY, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y],
            [posZ, gl.TEXTURE_CUBE_MAP_POSITIVE_Z],
            [negZ, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z]
        ];
        for (var i = 0; i < faces.length; i++) {
            var face = faces[i][1];
            var image = faces[i][0];
            gl.bindTexture(gl[$.cubeMapVar], texture);
            //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
            gl.texImage2D(face, 0, format, size, size, 0, format, gl[$.unsignedByteVar], image);
        }
        return texture;
    };

    this.data = function (array, width, height, format,clamp) {
        format = format || gl.RGBA;
        var texture = gl.createTexture();
        gl.bindTexture(gl[$.tex2DVar], texture);
        gl.texParameteri(gl[$.tex2DVar], gl[$.wrapSVar], clamp?gl[$.clampVar]:gl.REPEAT);
        gl.texParameteri(gl[$.tex2DVar], gl[$.wrapTVar], clamp?gl[$.clampVar]:gl.REPEAT);
        gl.texParameteri(gl[$.tex2DVar], gl[$.minFilterVar], gl[$.nearestVar]);
        gl.texParameteri(gl[$.tex2DVar], gl[$.magFilterVar], gl[$.linearVar]);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl[$.tex2DVar], 0, format, width, height, 0, format, gl[$.unsignedByteVar], array);
        return texture;
    };

    this.intensity = function (rgb) {
        return ((rgb[0] + rgb[1] + rgb[2]) / 3.0) / 255.0;
    };

    this.clamp = function (pX, pMax) {
        if (pX > pMax) {
            return pMax;
        }
        else if (pX < 0) {
            return 0;
        }
        else {
            return pX;
        }
    };

    // transform -1 - 1 to 0 - 255
    this.map_component = function (pX) {
        return (pX + 1.0) * (255.0 / 2.0);
    };

    this.getPixel = function (array, x, y, width) {
        return [array[y * width * 4 + x * 4], array[y * width * 4 + x * 4 + 1], array[y * width * 4 + x * 4 + 2]];
    };

    this.normal_from_height = function (input, size, strength) {
        strength = strength || 2;
        // assume square texture, not necessarily true in real code
        var result = new Array(input.length);
        var textureSize = size;

        for (var row = 0; row < textureSize; ++row) {
            for (var column = 0; column < textureSize; ++column) {
                // surrounding pixels
                var topLeft = this.getPixel(input, this.clamp(row - 1, textureSize), this.clamp(column - 1, textureSize), textureSize);
                var top = this.getPixel(input, this.clamp(row - 1, textureSize), this.clamp(column, textureSize), textureSize);
                var topRight = this.getPixel(input, this.clamp(row - 1, textureSize), this.clamp(column + 1, textureSize), textureSize);
                var right = this.getPixel(input, this.clamp(row, textureSize), this.clamp(column + 1, textureSize), textureSize);
                var bottomRight = this.getPixel(input, this.clamp(row + 1, textureSize), this.clamp(column + 1, textureSize), textureSize);
                var bottom = this.getPixel(input, this.clamp(row + 1, textureSize), this.clamp(column, textureSize), textureSize);
                var bottomLeft = this.getPixel(input, this.clamp(row + 1, textureSize), this.clamp(column - 1, textureSize), textureSize);
                var left = this.getPixel(input, this.clamp(row, textureSize), this.clamp(column - 1, textureSize), textureSize);

                // their intensities
                var tl = this.intensity(topLeft);
                var t = this.intensity(top);
                var tr = this.intensity(topRight);
                var r = this.intensity(right);
                var br = this.intensity(bottomRight);
                var b = this.intensity(bottom);
                var bl = this.intensity(bottomLeft);
                var l = this.intensity(left);

                // sobel filter
                var dX = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
                var dY = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);
                var dZ = 1.0 / strength;

                var v = vec3.create([dX, dY, dZ]);
                vec3.normalize(v);

                // convert to rgb
                result[row * textureSize * 4 + column * 4] = this.map_component(v[0]);
                result[row * textureSize * 4 + column * 4 + 1] = this.map_component(v[1]);
                result[row * textureSize * 4 + column * 4 + 2] = this.map_component(v[2]);
                result[row * textureSize * 4 + column * 4 + 3] = 255;
            }
        }

        return result;
    }


};