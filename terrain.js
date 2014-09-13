function TerrainGenerator(game)
{
    var t = this;
    t.game = game;
    t.generate = function(width,height,size)
    {
        t.height = height;
        t.width = width;
        t.size = size || 1;

        var nf = 3.4;
        var na = 30.0;
        var pf = 32.0;
        var pd = 52.0;
        var smooth = 126.0;
        var islandHeight = 350;

        var data = t.generateTerrain(width,height,size, nf,na,pf,pd,smooth,islandHeight,true);

        t.terrainVertices = data.vertices;

        return data;
    };

    t.generateTerrain = function(width,height,size,nf,na,pf,pd,smooth,islandHeight,uvRepeat)
    {
        var heightMap = t.generateHeightmap(width,height,nf,na,pf,pd,smooth,islandHeight);

        var terrainVerts = new Array(t.getVerticesCount(width,height));
        var terrainNormals = new Array(t.getVerticesCount(width,height));
        var uvCoords = new Array(t.getUvCount(width,height));

        var i = 0;
        var j = 0;

        for ( var row=0; row<height; row++ )
        {
            for ( var col=0; col<width; col++ )
            {
                if(uvRepeat)
                {
                    uvCoords[j++] = col%2;
                    uvCoords[j++] = row%2;
                }
                else
                {
                    uvCoords[j++] = col/(width-1);
                    uvCoords[j++] = row/(height-1);
                }
                terrainVerts[i++] = col/(width-1) * size;
                terrainVerts[i++] = heightMap ? heightMap[row][col] : 0;
                terrainVerts[i++] = row/(height-1) * size;
            }
        }

        for (var y = 0; y<height; ++y)
        {
            for (var x = 0; x<width; ++x)
            {
                var sx = t.getHeight(x<width-1 ? x+1 : x, y,width,height,terrainVerts) - t.getHeight(x>0 ? x-1 : x, y,width,height,terrainVerts);
                if (x == 0 || x == width-1)
                    sx *= 2;

                var sy = t.getHeight(x, y<height-1 ? y+1 : y,width,height,terrainVerts) - t.getHeight(x, y>0 ?  y-1 : y,width,height,terrainVerts);
                if (y == 0 || y == height -1)
                    sy *= 2;

                var n = vec3.create([-sx, 2, sy]);
                vec3.normalize(n);

                terrainNormals[y*width*3+x*3] = n[0];
                terrainNormals[y*width*3+x*3+1] = n[1];
                terrainNormals[y*width*3+x*3+2] = n[2];
            }
        }


        var terrainIndices = new Array(t.getIndicesCount(width, height));

        var i=0;


        for (var r = 0; r < height - 1; r++) {
            for (var c = 0; c < width - 1; c++) {
                terrainIndices[i++] = r * width + c;
                terrainIndices[i++] = r * width + c + 1;
                terrainIndices[i++] = (r + 1) * width + c;

                terrainIndices[i++] = r * width + c + 1;
                terrainIndices[i++] = (r + 1) * width + c;
                terrainIndices[i++] = (r + 1) * width + c + 1;
            }
        }

        return { vertices: terrainVerts, normals: terrainNormals, indices: terrainIndices, uvs: uvCoords, dataType: gl.TRIANGLES, width: width, height:height };
    };

    t.getHeight = function(x,y,width,height,verts)
    {
        verts = verts || t.terrainVertices;
        width = width || t.width;
        height = height || t.height;

        x = $.clamp(x,0,width-1);
        y = $.clamp(y,0,height-1);
        var index = x*3 + (width*3*y);
        return verts[index+1];
    };

    t.getSmoothedHeight = function(x,y)
    {
        var heights = new Array(4);
        heights[0] = t.getHeight($._(x), $._(y));
        heights[1] = t.getHeight($._(x), $.__(y));
        heights[2] = t.getHeight($.__(x), $._(y));
        heights[3] = t.getHeight($.__(x), $.__(y));


        var dx = x%1;
        var dy = y%1;

        var x1 = (heights[0]+(heights[2]-heights[0])*dx);
        var x2 = (heights[1]+(heights[3]-heights[1])*dx);
        var y1 = (heights[0]+(heights[1]-heights[0])*dy);
        var y2 = (heights[2]+(heights[3]-heights[2])*dy);

        return (x1+x2+y1+y2)/4;
    };

    t.generateHeightmap = function(width, height, nf, na, pf, pd, smooth, islandHeight)
    {
        var heights = new Array(height);

        for(var y=0;y<height;y++)
            heights[y] = new Array(width);

        heights = t.perlin(nf, na, heights, width, height);
        heights = t.perturb(pf,pd,heights, width, height);
        //heights = t.erode(smooth,heights, width, height);
        heights = t.smoothen(heights, width, height);
        if(islandHeight !== 0) heights = t.island(heights, islandHeight, width, height);

        return heights;
    };

    t.perlin = function(f, a, heights, width, height)
    {
        for(var y=0;y<height;y++)
        {
            for(var x=0;x<width;x++)
            {
                heights[y][x] = t.game.noiseGen.dirtyNoise2(x/height*f, y/width*f,0)*a;
            }
        }

        return heights;
    };

    t.perturb = function(f, d, heights, width, height)
    {
        var u, v;
        var temp = new Array(height);

        for (var i = 0; i < height; ++i)
        {
            temp[i] = new Array(width);
            for (var j = 0; j < width; ++j)
            {
                u = i + $._(t.game.noiseGen.random(f * i / height, f * j / width, 0) * d);
                v = j + $._(t.game.noiseGen.random(f * i / height, f * j / width, 1) * d);
                if (u < 0) u = 0; if (u >= height) u = height - 1;
                if (v < 0) v = 0; if (v >= width) v = width - 1;
                temp[i][j] = heights[u][v];
            }
        }
        return temp;
    };

    t.smoothen = function(heights, width, height)
    {
        for (var i = 1; i < height - 1; ++i)
        {
            for (var j = 1; j < width - 1; ++j)
            {
                var total = 0.0;
                for (var u = -1; u <= 1; u++)
                {
                    for (var v = -1; v <= 1; v++)
                    {
                        total += heights[i + u][j + v];
                    }
                }

                heights[i][j] = total / 9.0;
            }
        }

        return heights;
    };

    t.island = function(heights, centerHeight, width, height)
    {
        for (var i = 0; i < height; ++i)
        {
            for (var j = 0; j < width; ++j)
            {
                heights[i][j] += centerHeight * ($.s(i/height*$.PI) * $.s(j/width*$.PI));
            }
        }

        return heights;
    };



    t.getVerticesCount = function( width, height ) {
        return width * height * 3;
    };

    t.getUvCount = function( width, height ) {
        return width * height * 2;
    };

    t.getIndicesCount = function( width, height ) {
        return (width*height) + (width-1)*(height-2);
    }

};