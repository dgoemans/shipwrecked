var shaders = {};

function Model(game, buffers, materialName, texture, normalMap, reflectionMap)
{
    var t = this;
    t.game = game;
    t.dataType = buffers.dataType;

    t.writeDepth = true;
    t.readDepth = true;
    t.offset = vec3.create();
    t.position = vec3.create();
    t.scale =  vec3.create([1,1,1]);
    t.ambientColor = vec3.create([1.0,1.0,1.0]);
    t.rotationAxis = vec3.create();
    t.rotationAngle = 0;
    t.physics = false;
    t.collider = {};
    t.velocity = vec3.create();
    t.parent = null;
    t.c = [];
    t.billboard = false;
    t.type = 0;

    t.drawOrder = 0;
    t.depthSort = false;


    t.texture = texture;
    t.normalMap = normalMap;
    t.reflectionMap = reflectionMap;
    t.materialName = materialName;
    t.time = 0;
    t.eye = vec3.create();
    t.seed = 0;
    t.lightDirection = vec3.create();

    t.createBuffer = function(buffer,size)
    {
        var glBuffer = gl.createBuffer();
        var arraybuffer = gl.ARRAY_BUFFER;
        gl.bindBuffer(arraybuffer, glBuffer);
        gl.bufferData(arraybuffer, new Float32Array(buffer), gl.STATIC_DRAW);
        glBuffer.itemSize = size;
        glBuffer.numItems = buffer.length;
        return glBuffer;
    }

    t.init = function(buffers)
    {
        t.vertexBuffer = t.createBuffer(buffers.vertices,3);
        t.normalBuffer = t.createBuffer(buffers.normals,3);
        t.tangentBuffer = t.createBuffer(buffers.tangents,4);
        t.uvBuffer = t.createBuffer(buffers.uvs,2);

        t.indexBuffer = gl.createBuffer();
        var elementarraybuffer = gl.ELEMENT_ARRAY_BUFFER;
        gl.bindBuffer(elementarraybuffer, t.indexBuffer);
        gl.bufferData(elementarraybuffer, new Uint16Array(buffers.indices), gl.STATIC_DRAW);
        t.indexBuffer.itemSize = 1;
        t.indexBuffer.numItems = buffers.indices.length;
    };

    t.getShader = function(id, extension, type) {

        var xhr = new XMLHttpRequest();

        var body = '';
        xhr.open('GET', 's' + extension, false);
        xhr.send();
        body = xhr.responseText;
        body = body.replace(/@/g, 'attribute').replace(/€/g, 'uniform').replace(/\$/g, 'varying').replace(/v2/g, 'vec2').replace(/v3/g, 'vec3').replace(/v4/g, 'vec4');

        var shader = gl.createShader(type);

        gl.shaderSource(shader, '#define ' + id + '\n' + body);
        gl.compileShader(shader);

        return shader;
    };

    t.createMaterial = function (name)
    {
        if( shaders[name] )
        {
            return shaders[name];
        }

        var shader = null;

        var fragmentShader = t.getShader(name, ".ps", gl.FRAGMENT_SHADER);
        var vertexShader = t.getShader("shaders.min", ".vs", gl.VERTEX_SHADER);

        shader = gl.createProgram();
        gl.attachShader(shader, vertexShader);
        gl.attachShader(shader, fragmentShader);
        gl.linkProgram(shader);

        var status = gl.getProgramParameter(shader, gl.LINK_STATUS);
        if (!status) {
            console.error("Could not initialise shaders: " + status);
            return;
        }

        gl.useProgram(shader);

        shader.vertexPositionAttribute = gl.getAttribLocation(shader, "aV");
        shader.vertexNormalAttribute = gl.getAttribLocation(shader, "aVN");
        shader.textureCoordAttribute = gl.getAttribLocation(shader, "aTex");
        shader.vertexTangentAttribute = gl.getAttribLocation(shader, "aVTn");

        shader.pMatrixUniform = gl.getUniformLocation(shader, "uP");
        shader.mvMatrixUniform = gl.getUniformLocation(shader, "uMV");
        shader.nMatrixUniform = gl.getUniformLocation(shader, "uN");
        shader.modelMatrixUniform = gl.getUniformLocation(shader, "uM");

        // opt
        shader.textureUniform = gl.getUniformLocation(shader, "sD");
        shader.normalUniform = gl.getUniformLocation(shader, "sN");
        shader.reflectUniform = gl.getUniformLocation(shader, "sR");
        shader.ambientColorUniform = gl.getUniformLocation(shader, "uA");
        shader.lightingDirectionUniform = gl.getUniformLocation(shader, "uL");
        shader.directionalColorUniform = gl.getUniformLocation(shader, "uD");
        shader.timeUniform = gl.getUniformLocation(shader, "uT");
        shader.eyeUniform = gl.getUniformLocation(shader, "uE");
        shader.seedUniform = gl.getUniformLocation(shader, "uS");

        shaders[name] = shader;
        return shader;
    };

    t.enableAttributes = function(shader)
    {
        gl.enableVertexAttribArray(shader.vertexPositionAttribute);
        gl.enableVertexAttribArray(shader.vertexNormalAttribute);
        gl.enableVertexAttribArray(shader.textureCoordAttribute);
        gl.enableVertexAttribArray(shader.vertexTangentAttribute );
    };

    t.disableAttributes = function(shader)
    {
        gl.disableVertexAttribArray(shader.vertexPositionAttribute);
        gl.disableVertexAttribArray(shader.vertexNormalAttribute);
        gl.disableVertexAttribArray(shader.textureCoordAttribute);
        gl.disableVertexAttribArray(shader.vertexTangentAttribute );
    };

    t.setScale = function(scale)
    {
        if( typeof scale === 'number' )
            vec3.set([scale,scale,scale], t.scale);
        else
            vec3.set(scale, t.scale);
    };

    t.update = function(delta)
    {
        t.time = t.game.elapsedTime;
        t.eye = t.game.eyePoint;


        if(t.parent)
        {
            vec3.set(t.parent.position,t.position);
            vec3.set(t.parent.rotationAxis,t.rotationAxis);
            t.rotationAngle = t.parent.rotationAngle;
        }
        else if(t.physics)
        {
            var vel = vec3.create();
            vec3.scale(t.velocity, delta, vel);
            vec3.add(t.position, vel, t.position);

            var height = t.game.getTerrainHeight(t.position[0], t.position[2]);
            if( t.position[1] < height + t.collider.radius )
            {
                t.position[1] = height + t.collider.radius;
                vec3.set([0,0,0], t.velocity);
            }

            t.velocity[1] += -9.8;
        }

        if(t.depthSort)
        {
            var distance = vec3.create();
            vec3.subtract(t.eye, t.position, distance);
            t.drawOrder = 40000 - vec3.length(distance);
        }
    };

    t.draw = function(perspective, model, view)
    {
        var currentShader = t.shader;

        gl.useProgram(currentShader);

        t.enableAttributes(currentShader);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, t.texture);
        gl.uniform1i(currentShader.textureUniform, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, t.normalMap);
        gl.uniform1i(currentShader.normalUniform, 1);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, t.reflectionMap);
        gl.uniform1i(currentShader.reflectUniform, 2);

        gl.uniform3fv(currentShader.ambientColorUniform, t.ambientColor);
        gl.uniform1f(currentShader.timeUniform, t.time);
        gl.uniform1f(currentShader.seedUniform, t.seed);
        gl.uniform3fv(currentShader.eyeUniform, t.eye);

        var adjustedLD = vec3.create();
        vec3.normalize(t.lightDirection, adjustedLD);
        vec3.scale(adjustedLD, -1);
        gl.uniform3fv(currentShader.lightingDirectionUniform, adjustedLD);

        gl.uniform3f(currentShader.directionalColorUniform,0.6,0.6,0.6);

        t.setMatrixUniforms(perspective, model, view, currentShader);


        t.arraybuffer = gl.ARRAY_BUFFER;
        t.setBuffer(t.vertexBuffer, currentShader.vertexPositionAttribute);
        t.setBuffer(t.normalBuffer, currentShader.vertexNormalAttribute);
        t.setBuffer(t.tangentBuffer, currentShader.vertexTangentAttribute);
        t.setBuffer(t.uvBuffer, currentShader.textureCoordAttribute);

        gl.depthMask(t.writeDepth);
        t.readDepth ? gl.enable(gl.DEPTH_TEST) : gl.disable(gl.DEPTH_TEST);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, t.indexBuffer);
        gl.drawElements(t.dataType, t.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

        t.disableAttributes(currentShader);
    };

    t.setBuffer = function(buffer,attr)
    {
        gl.bindBuffer(t.arraybuffer, buffer);
        gl.vertexAttribPointer(attr, buffer.itemSize, gl.FLOAT, false, 0, 0);
    }


    t.setMatrixUniforms = function(perspective, model, view, currentShader)
    {
        if(t.billboard)
        {
            mat4.identity(model);
            mat4.inverse(view, model);
            mat4.toRotationMat(model, model);
            mat4.scale(model, t.scale, model);

            model[12] = t.position[0];
            model[13] = t.position[1];
            model[14] = t.position[2];

        }
        else
        {
            mat4.translate(model, t.position, model);
            mat4.rotate(model, t.rotationAngle, t.rotationAxis, model);
            mat4.scale(model,t.scale, model);

            var invOffset = vec3.create();
            vec3.subtract(invOffset, t.offset, invOffset);
            mat4.translate(model, invOffset, model);

        }


        var modelView = mat4.create();
        mat4.multiply(view, model, modelView);


        gl.uniformMatrix4fv(currentShader.pMatrixUniform, false, perspective);
        gl.uniformMatrix4fv(currentShader.mvMatrixUniform, false, modelView);
        gl.uniformMatrix4fv(currentShader.modelMatrixUniform, false, model);

        var normalMatrix = mat3.create();
        mat4.toInverseMat3(modelView, normalMatrix);
        mat3.transpose(normalMatrix, normalMatrix);
        gl.uniformMatrix3fv(currentShader.nMatrixUniform, false, normalMatrix);
    };

    t.setParent = function(parent)
    {
        if(parent)
            parent.c.push(this);
        else
            t.parent.c.removeItem(this);

        t.parent = parent;
    }


    t.generateTangents = function(buffers)
    {
        var triangleCount = buffers.indices.length;
        var vertexCount = buffers.vertices.length;

        var tan1 = new Array(vertexCount);
        var tan2 = new Array(vertexCount);

        var tangents = new Array($.__(vertexCount+vertexCount/3));

        for(var a = 0; a < triangleCount; a+=3)
        {
            var i1 = buffers.indices[a+0];
            var i2 = buffers.indices[a+1];
            var i3 = buffers.indices[a+2];

            var v1 = [buffers.vertices[i1*3],buffers.vertices[i1*3+1],buffers.vertices[i1*3+2]];
            var v2 = [buffers.vertices[i2*3],buffers.vertices[i2*3+1],buffers.vertices[i2*3+2]];
            var v3 = [buffers.vertices[i3*3],buffers.vertices[i3*3+1],buffers.vertices[i3*3+2]];

            var w1 = [buffers.uvs[i1*2],buffers.uvs[i1*2+1]];
            var w2 = [buffers.uvs[i2*2],buffers.uvs[i2*2+1]];
            var w3 = [buffers.uvs[i3*2],buffers.uvs[i3*2+1]];

            var x1 = v2[0] - v1[0];
            var x2 = v3[0] - v1[0];
            var y1 = v2[1] - v1[1];
            var y2 = v3[1] - v1[1];
            var z1 = v2[2] - v1[2];
            var z2 = v3[2] - v1[2];

            var s1 = w2[0] - w1[0];
            var s2 = w3[0] - w1[0];
            var t1 = w2[1] - w1[1];
            var t2 = w3[1] - w1[1];

            var r = 1.0 / (s1 * t2 - s2 * t1);

            var sdir = vec3.create([(t2 * x1 - t1 * x2) * r, (t2 * y1 - t1 * y2) * r, (t2 * z1 - t1 * z2) * r]);
            var tdir = vec3.create([(s1 * x2 - s2 * x1) * r, (s1 * y2 - s2 * y1) * r, (s1 * z2 - s2 * z1) * r]);

            if(!tan1[i1]) tan1[i1] = vec3.create();
            if(!tan1[i2]) tan1[i2] = vec3.create();
            if(!tan1[i3]) tan1[i3] = vec3.create();

            if(!tan2[i1]) tan2[i1] = vec3.create();
            if(!tan2[i2]) tan2[i2] = vec3.create();
            if(!tan2[i3]) tan2[i3] = vec3.create();

            vec3.add(tan1[i1], sdir);
            vec3.add(tan1[i2], sdir);
            vec3.add(tan1[i3], sdir);

            vec3.add(tan2[i1], tdir);
            vec3.add(tan2[i2], tdir);
            vec3.add(tan2[i3], tdir);
        }


        var i=0;
        for (var a = 0; a < vertexCount/3; a++)
        {
            var n = vec3.create([buffers.normals[a*3],buffers.normals[a*3+1],buffers.normals[a*3+2]]);
            var t = tan1[a];

            var tmp = vec3.create();
            vec3.normalize(vec3.subtract(t, vec3.scale(n,vec3.dot(n, t))),tmp);
            tangents[i++] = tmp[0];
            tangents[i++] = tmp[1];
            tangents[i++] = tmp[2];
            tangents[i++] = (vec3.dot(vec3.cross(n, t), tan2[a]) < 0.0) ? -1.0 : 1.0;
        }

        buffers.tangents = tangents;
    };

    t.generateTangents(buffers);

    t.init(buffers);
    t.shader = t.createMaterial(t.materialName);
}