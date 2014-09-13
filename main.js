// glMatrix docs:
// http://glmatrix.net/docs/2.2.0/

(function()
{
    window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
})();

$.clamp = function(value,min,max){
    return $.max($.min(value,max),min);
};

Array.prototype.removeItem = function(item)
{
    var index = this.indexOf(item);
    if (index > -1) { this.splice(index, 1); }
    return item;
};


var gl;

function Game()
{
    var t = this;

    t.modelMatrix = mat4.create();
    t.pMatrix = mat4.create();

    t.terrainWidth = 256;
    t.terrainDepth = 256;
    t.scale = 40*t.terrainWidth;
    t.cameraMat = mat4.create();
    t.upVector = vec3.create([0,1,0]);
    t.playerHeight = 70;
    t.eyePoint = vec3.create([-4000,0,-4000]);
    t.lookAtPoint = vec3.create([0,0, 0]);
    t.walkSpeed = 250;
    t.waterSpeed = 10;
    t.lightDirection = vec3.create([0.05,-1,0.05]);
    t.locked = 1;
    t.msgTime = 1000;
    t.waterBob = 5;

    t.then = Date.now();

    t.elapsedTime = 0;
    t.initialized = false;
    t.jumping = false;
    t.velocity = vec3.create();
    t.lastX = 0;
    t.lastY = 0;

    t.qteActive = false;
    t.qteTime = 0;
    t.qteSequence = [];
    t.qteReactionTime = 0.8;
    t.qteSuccessRequired = 0;

    t.state = 0;

    t.inputAllowed = false;

    t.fire = null;
    t.drawList = [];
    t.shots = [];

    t.noiseGen = new NoiseGenerator(this);
    t.terrainGen = new TerrainGenerator(this);
    t.textureGen = new TextureGenerator(this);
    t.geometryGen = new GeometryGenerator(this);
    t.i = new Input();

    t.sortDraw = function(a,b)
    {
        return a.drawOrder - b.drawOrder;
    };

    t.drawScene = function(){

        gl.clearColor(0.6, 0.95, 1.0, 1.0);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        mat4.perspective(30, gl.viewportWidth / gl.viewportHeight, 10.0, 40000, t.pMatrix);

        gl.bindFramebuffer(gl.FRAMEBUFFER, t.rttFramebuffer);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        for(var i=0; i<t.drawList.length; i++)
        {
            mat4.identity(t.modelMatrix);
            t.drawList[i].draw(t.pMatrix, t.modelMatrix, t.cameraMat);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        var w = 0.5;
        mat4.ortho(-w, w, -w, w, 0.1, 100, t.pMatrix);
        mat4.identity(t.modelMatrix);
        t.rendertexture.draw(t.pMatrix, t.modelMatrix, mat4.identity(mat4.create()));
    };

    t.update = function()
    {
        var now = Date.now();
        var delta = $.min(1000, now - t.then); // Worst case = 1fps
        var deltaSeconds = delta/1000;
        t.elapsedTime += deltaSeconds;

        var frontDirection = vec3.create();
        var strafeDirection = vec3.create();
        vec3.subtract(t.lookAtPoint, t.eyePoint, frontDirection);
        vec3.normalize(frontDirection);
        vec3.cross(frontDirection, t.upVector, strafeDirection);
        vec3.normalize(strafeDirection);

        var forwardScale = 0.0;
        var strafeScale = 0.0;

        if( t.i.wasPressed(t.i.U) )
        {
            t.locked = !t.locked;
        }
        else if( t.i.wasPressed(t.i.SPACE) && !t.jumping )
        {
            t.jumping = true;
            t.velocity[1] = 150;
        }
        else if( t.i.wasPressed(t.i.M) )
        {
//            t.startEruption();
        }

        if(t.inputAllowed)
        {
            if (t.i.isDown(t.i.UP) || t.i.isDown(t.i.W)) {
                forwardScale += 1.0;
            }
            if (t.i.isDown(t.i.DOWN) || t.i.isDown(t.i.A)) {
                forwardScale -= 1.0;
            }
            if (t.i.isDown(t.i.LEFT) || t.i.isDown(t.i.S)) {
                strafeScale -= 1.0;
            }
            if (t.i.isDown(t.i.RIGHT) || t.i.isDown(t.i.D)) {
                strafeScale += 1.0;
            }
        }

        if( t.qteSuccessRequired )
        {
            t.qteTime += deltaSeconds;
            var expected = t.qteSequence[0].time;
            var tooSoon = t.qteTime < expected;
            var tooLate = expected + t.qteReactionTime < t.qteTime;

            if( !tooSoon && !tooLate )
            {
                if(t.mobile)
                    t.showMessage('Tap with 2 fingers');
                else
                    t.showMessage('Press: ' + String.fromCharCode(t.qteSequence[0].key));
                if(t.i.wasPressed(t.qteSequence[0].key))
                {
                    t.showMessage();
                    t.qteAction();
                    t.qteSequence.shift();
                    t.qteSuccessRequired--;
                }
                else if(t.i.wasPressed(t.i.Q) || t.i.wasPressed(t.i.E))
                {
                    t.showMessage();
                    t.qteSequence.shift();
                }
            }
            else if(tooLate)
            {
                t.showMessage();
                t.qteSequence.shift();
            }

            if(t.qteSequence.length === 0)
            {
                if(t.qteSuccessRequired>0)
                    t.addQte(expected+t.qteReactionTime, t.qteSuccessRequired);
            }
        }


        var inWater = t.eyePoint[1] < t.playerHeight/2;
        var velocity = (inWater && t.locked && !t.qteSuccessRequired ? t.waterSpeed : t.walkSpeed) * deltaSeconds;

        forwardScale *= velocity;
        strafeScale *= velocity;

        vec3.scale(frontDirection, forwardScale);
        vec3.scale(strafeDirection, strafeScale);

        var vel = vec3.create();
        vec3.scale(t.velocity,deltaSeconds,vel);
        vec3.add(frontDirection, vel, frontDirection)
        t.velocity[1] -= 9.8;
        t.velocity[0] *= 0.98;
        t.velocity[2] *= 0.98;

        vec3.add(frontDirection,strafeDirection);

        vec3.add(t.eyePoint, frontDirection);
        vec3.add(t.lookAtPoint, frontDirection);

        var terrainHeight = t.getTerrainHeight(t.eyePoint[0], t.eyePoint[2]);

        // Under water?
        if( t.locked )
        {
            var delta = terrainHeight + t.playerHeight - t.eyePoint[1]
            if( delta > 0 )
            {
                t.jumping = false;
                t.velocity[1] = 0;
                t.eyePoint[1] += delta;
                t.lookAtPoint[1] += delta;
            }
        }
        else
            t.velocity[1] = 0;

        mat4.identity(t.cameraMat);
        mat4.lookAt(t.eyePoint, t.lookAtPoint, t.upVector,t.cameraMat);

        var offset = vec3.subtract(t.lookAtPoint,t.eyePoint, vec3.create());
        vec3.scale(offset,50);
        vec3.add(offset,t.eyePoint,t.player.position);

        for(var i=0; i<t.drawList.length; i++)
        {
            var item = t.drawList[i];
            if( (item.physics && item.position[1] < 0) || item.dead )
            {
                t.destroy(item);
                t.drawList.removeItem(item);
                i--;
                continue;
            }

            item.lightDirection = t.lightDirection;
            item.update(deltaSeconds);
        }

        t.drawList.sort(t.sortDraw);

        t.drawScene();

        switch(t.state)
        {
            case 0:
                t.waterBob = ($.s(t.elapsedTime)+1)*5+5;
                if(!inWater)
                {
                    vec3.set([0,0,0],t.velocity);
                    t.playerHeight = 70;
                    t.qteSequence = [];
                    t.qteSuccessRequired = 0;
                    t.inputAllowed = true;
                    t.state = 1;
                    t.msg3();
                }
                break;
            case 2:
                if(!t.qteSuccessRequired)
                {
                    t.showMessage('Quick, blow on the fire to keep it going!');
                    t.state = 3;
                    t.qteTime = 0;
                    t.addQte(1.5,10);
                    t.qteAction = function(){
                        var scale = t.fire.scale[1];
                        scale += 5;
                        t.fire.setScale(scale);
                    }
                }
                break;
            case 3:
                if(!t.qteSuccessRequired)
                {
                    t.showMessage('Whew. Hopefully this will get some attention. Time to get some rest', t.msgTime, t.msgRelax)
                    t.state = 4;
                }
                break;
            case 5:
                break;
        }

        t.then = now;
    };

    t.getTerrainHeight = function(x,y)
    {
        var h = t.terrainGen.getSmoothedHeight((x-t.terrainModel.position[0])/t.scale*t.terrainWidth, (y-t.terrainModel.position[2])/t.scale*t.terrainDepth) + t.terrainModel.position[1];
        return $.max(h,-t.playerHeight+t.waterBob);
    };

    t.destroy = function(item)
    {
        // Kill all children
        for(var j=0;j<item.c.length;j++)
            t.drawList.removeItem(item.c[j]);

        t.drawList.removeItem(item);
    }

    t.spawnFire = function(parent,billboard,size)
    {
        var fire = new Model(this, t.geometryGen.quad(size,size,0.5,0.2), 'fire', null);
        fire.setParent(parent);
        fire.billboard = billboard;
        fire.depthSort = true;
        fire.seed = $.r()*46547;
        t.drawList.push(fire);
        return fire;
    };

    t.spawnRock = function(x, z, y)
    {
        y = y || t.getTerrainHeight(x,z);
        var rad = 5;
        var mdl = t.spawnModel(t.geometryGen.rock(rad,0.2,0.05), [x,y,z], [0,1,0], $.r()* $.PI * 2, 'bumpmap', t.meteorColor, t.meteorBumpMap)
        vec3.set([0.5,0.5,0.5],mdl.ambientColor);
        mdl.collider.radius = rad;
        mdl.physics = true;
        mdl.type = 1;
        return mdl;
    };

    t.spawnShot = function()
    {
        var mdl = t.spawnRock(7400,7400,1600)
        mdl.physics = false;
        mdl.type = 3;

        var fire = t.spawnFire(mdl,true,200);
        mdl.c.push(fire);

        t.shots.push(mdl);

        setTimeout(function(){
            mdl.type = 1;
            fire.dead = true;
        }, 30000);

        return mdl;
    };

    t.showMessage = function(text, time, callback, context)
    {
        var hud = document.getElementById('hud');

        function toggle(on) {
            hud.style.display = on ? 'block' : 'none';
        }

        toggle(1);

        if( !text )
        {
            toggle(0);
            return;
        }

        if( time )
        {
            var timer = time/1000;
            var text2 = text.replace('{0}', timer);
            hud.innerHTML = text2;

            var interval = setInterval(function(){
                text2 = text.replace('{0}', timer);
                hud.innerHTML = text2;
                timer--;
                if( timer < 0 )
                {
                    toggle(0);
                    clearInterval(interval);
                    if(callback) callback.call(t);
                }
            }, 1000);
        }
        else
        {
            hud.innerHTML = text;
        }

    };

    t.spawnWood = function(x,z)
    {
        var y = t.getTerrainHeight(x,z);
        var wood = t.spawnModel(t.geometryGen.cube(40 + $.r()*10, 1, 2 + $.r()*5, 0.5, 0.5, 0.5), [x,y,z], [0, 1,0], $.r()* $.PI,'bumpmap', t.textureGen.createColorTexture(236,217,153), t.roughBumpmap);
        vec3.set([0.62, 0.54, 0.29],wood.ambientColor);
        wood.physics = true;
        wood.collider.radius = 3;
        wood.type = 2;
    };

    t.spawnModel = function(buffers, position, rotationAxis, rotationAngle, shader, t1, t2, t3)
    {
        var mdl = new Model(this, buffers, shader, t1, t2, t3);
        vec3.set(position, mdl.position);
        vec3.set(rotationAxis, mdl.rotationAxis);
        mdl.rotationAngle = rotationAngle
        t.drawList.push(mdl);
        return mdl;
    };

    t.addQte = function(time,s)
    {
        t.qteSuccessRequired = s;
        var key = t.mobile ? t.i.mouse : $.r()<0.5?t.i.E:t.i.Q ;
        t.qteSequence.push({ key: key, time: time });
    };

    t.initGame = function()
    {
        var regex = /Mobile|Android|BlackBerry/;
        t.mobile = regex.test(navigator.userAgent);
        regex = /Trident/;
        t.ie = regex.test(navigator.userAgent);
        t.noMouseLock = t.mobile || t.ie;

        var canvas = document.getElementById("glcanvas");

        canvas.width = window.innerWidth*(this.mobile?0.6:0.7);
        canvas.height = window.innerHeight*(canvas.width/window.innerWidth);

        gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        var f = gl.FRAMEBUFFER;
        var r = gl.RENDERBUFFER;
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
        t.rttFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(f, t.rttFramebuffer);

        var canvas = document.getElementById("glcanvas");
        t.rttFramebuffer.width = canvas.width;
        t.rttFramebuffer.height = canvas.height;
        t.rttTexture = t.textureGen.data(null,t.rttFramebuffer.width,t.rttFramebuffer.height, gl.RGBA, true);

        var renderbuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(r, renderbuffer);
        gl.renderbufferStorage(r, gl.DEPTH_COMPONENT16, t.rttFramebuffer.width, t.rttFramebuffer.height);

        gl.framebufferTexture2D(f, gl.COLOR_ATTACHMENT0, gl[$.tex2DVar], t.rttTexture, 0);
        gl.framebufferRenderbuffer(f, gl.DEPTH_ATTACHMENT, r, renderbuffer);

        gl.bindTexture(gl[$.tex2DVar], null);
        gl.bindRenderbuffer(r, null);
        gl.bindFramebuffer(f, null);


        t.meteorBumpMap = t.textureGen.createNoiseBumpMap(5, 1.0, t.noiseGen.dirtyNoise2, 130, 125);
        t.meteorColor = t.textureGen.createColorTexture(119, 115, 91);
        t.roughBumpmap = t.textureGen.createNoiseBumpMap(1, 2.0, t.noiseGen.random, 180, 75, 128);
        var oceanBlue = t.textureGen.createColorTexture(10, 100, 120);
        var sand = t.textureGen.createColorTexture(255, 207, 129);

        var size;

        t.terrainModel = new Model(this, t.terrainGen.generate(t.terrainWidth,t.terrainDepth, t.scale), 'bumpmap', sand, t.roughBumpmap);
        t.terrainModel.ambientColor = vec3.create([1.0, 0.80, 0.52]);
        vec3.set([-t.scale/2,-200,-t.scale/2], t.terrainModel.position);
        t.drawList.push(t.terrainModel);

        size = 30000;
        t.spawnModel(t.terrainGen.generateTerrain(2,2,size,0,0,0,0,0,0), [-size/2,0,-size/2], [1,0,0], 0,'water', oceanBlue, t.textureGen.createNoiseBumpMap(50, 1.0, t.noiseGen.random, 130, 125), t.textureGen.createCubeMap(20,120,150,255));

        size = 60000;
        t.spawnModel(t.terrainGen.generateTerrain(20,20,size,0,0,0,0,0,10500), [-size/2,-1000,-size/2],[0,0,0], 0,'unlit', t.textureGen.createCloudTexture());

        size = 1000;
        var variance = 12000;
        for(var i=0;i<10; i++)
        {
            var island = t.spawnModel(t.terrainGen.generateTerrain(7,7,size + $.r()*2000,3.4,30,32,52,126,150), [$.s(i/10* $.PI*2)*variance,-50, $.c(i/10* $.PI*2)*variance],[0,0,0], 0, 'bumpmap', sand, t.roughBumpmap);
            island.ambientColor = vec3.create([1.0, 0.80, 0.52]);
        }

        for(var i=0; i<200;i++)
        {
            t.spawnShot();
        }

        size = 5000;
        t.volcano = t.spawnModel(t.terrainGen.generateTerrain(200,200,size,3.4,30,32,52,126,2000), [5000,-200,5000],[0,0,0], 0, 'bumpmap', sand, t.roughBumpmap);
        t.volcano.ambientColor = vec3.create([0.3, 0.20, 0.12]);


        t.lavaRed = t.textureGen.createColorTexture(120, 20, 10);
        var mdl = new Model(this, t.geometryGen.rock(800,0.0,0.08),'water', t.lavaRed, t.textureGen.createNoiseBumpMap(10, 1.0, t.noiseGen.dirtyNoise2, 130, 125), t.textureGen.createCubeMap(225, 20, 10,255));
        vec3.set([7400,1150,7300],mdl.position);
        t.drawList.push(mdl);

        size = 1.0;
        t.player = new Model(this, t.geometryGen.cube(size,size,size, 0.5, 0.5,0.5), 'unlit', t.textureGen.createColorTexture(255,255,255));
        t.player.rotationAxis[1] = 1;
        t.player.billboard = true;
        t.player.writeDepth = t.player.readDepth = false;
        t.player.drawOrder = Infinity;
        t.drawList.push(t.player);

        var spread = 5000;

        for(var i=0; i<85; i++)
        {
            (i<5)?t.spawnRock(-spread/2 + $.r()*spread, -spread/2 + $.r()*spread):t.spawnWood(-spread/2 + $.r()*spread, -spread/2 + $.r()*spread);
        }

        t.rendertexture = new Model(this, t.geometryGen.quad(1,1,0.5,0.5), 'bloom', t.rttTexture);
        vec3.set([0,0,-50],t.rendertexture.position);


        gl.clearColor(0.6, 0.95, 1.0, 1.0);
        gl.enable(gl.DEPTH_TEST);

        var this_ = this;

        var zEl = document.getElementById('z');
        if(this_.mobile)
        {
            zEl.addEventListener('touchstart', function() {
                this_.i.onKeydown({keyCode: this_.i.W});
                this_.actionLock = true;
            });
            zEl.addEventListener('touchend', function() {
                this_.i.onKeyup({keyCode: this_.i.W});
                this_.actionLock = false;
            });
            zEl.style.display = 'block';
        }


        window.addEventListener('keyup', function(event) { this_.i.onKeyup(event); }, false);
        window.addEventListener('keydown', function(event) { this_.i.onKeydown(event); }, false);

        function mousedown(event){

            var ptrLockElt = document['pointerLockElement'] || document['mozPointerLockElement'] || document['webkitPointerLockElement'];
            if(!ptrLockElt && !this_.mobile)
            {
                this_.lockPointer();
            }
            else
            {
                if(this_.mobile && event.touches)
                {
                    this_.lastX = event.touches[0].pageX;
                    this_.lastY = event.touches[0].pageY;

                    if(event.touches.length > 1)
                        this_.i.onKeydown({keyCode: -1});
                }
                else if(!this_.actionLock)
                    this_.action(event);
            }
        }
        document.body.addEventListener('mousedown', mousedown);
        document.body.addEventListener('touchstart', mousedown);

        function mouseup(event) {

            if(this_.mobile && event.touches)
            {
                if(event.touches.length > 0) this_.i.onKeyup({keyCode: -1});
                //this_.i.onKeyup({keyCode: this_.i.W});
            }
        }

        t.mobile ? document.body.addEventListener("touchend", mouseup) : document.body.addEventListener("mouseup", mouseup);

        function mousemove(event) {

            var ptrLockElt = document['pointerLockElement'] || document['mozPointerLockElement'] || document['webkitPointerLockElement'];
            var movementX = event['movementX'] || event['mozMovementX'] || event['webkitMovementX'] || 0;
            var movementY = event['movementY'] || event['mozMovementY'] || event['webkitMovementY'] || 0;

            if(ptrLockElt !== document.body)
            {
                var xDelta = 0;
                var yDelta = 0;

                if(this_.noMouseLock)
                {
                    var x = event.pageX || event.touches[0].pageX;
                    var y = event.pageY || event.touches[0].pageY;
                    var xDelta = x - this_.lastX;
                    var yDelta = y - this_.lastY;
                    this_.lastX = x;
                    this_.lastY = y;
                }
            }
            else
            {
                if( ptrLockElt )
                {
                    var xDelta = movementX;
                    var yDelta = movementY;
                }

                var maxMovement = 100;
                xDelta = $.clamp(xDelta,-maxMovement,maxMovement);
                yDelta = $.clamp(yDelta,-maxMovement,maxMovement);
            }

            if(this_.inputAllowed)
                this_.rotateView(xDelta, yDelta);

        }
        t.mobile ? document.body.addEventListener("touchmove", mousemove, false) : document.body.addEventListener("mousemove", mousemove, false);

        t.initialized = true;

        t.showMessage('Where am I?', t.msgTime, t.msg1);
    };

    t.startSwim = function(){
        t.addQte(0,Infinity);
        t.qteAction = function() { t.velocity[0] += 100; t.velocity[2] += 100; };
    };

    t.msg1 = function()
    {
        t.showMessage('Oh yeah, the Jolly Rogier was hit by some volcano debris.', t.msgTime, t.msg2);
    };

    t.msg2 = function()
    {
        t.showMessage("I should swim over to the island", t.msgTime, t.startSwim);
    };

    t.msg3 = function()
    {
        t.showMessage("I'm safe for now, but I need to attract some attention. What I can use?", t.msgTime);
    };


    t.msgRelax = function()
    {
        t.lookAtPoint = t.volcano.position;
        t.inputAllowed = false;
        t.startEruption();
        t.showMessage("Oh no. I think it's going to erupt again!", t.msgTime);
    };

    t.startEruption = function()
    {
        t.state = 5;
        setTimeout(function(){
            for(var i=0; i<t.shots.length; i++)
            {
                vec3.set([(-0.5 + $.s($.r()* $.PI))*1000,(-0.5 + $.r())*3000 + 1500,(-0.5 + $.c($.r()* $.PI))*1000],t.shots[i].velocity)
                t.shots[i].physics = true;
                setTimeout(function(){
                    document.getElementById("glcanvas").style.opacity = 0;
                },10000);
            }
        }, 3000)
    };

    t.action = function(event)
    {
        var collectible = t.player.item;

        if(collectible)
        {

            var woodReq = 5;
            var woodPile = 0;
            var wood = null;
            var stone = null;

            for(var i=0; i<t.drawList.length;i++)
            {
                var item = t.drawList[i];
                if(!item.physics || item === collectible)
                    continue;

                var pos1 = vec3.create(item.position);
                var pos2 = vec3.create(t.player.position);
                pos1[1] = pos2[1] = 0;

                var distanceSqr = vec3.distanceSqr(pos1, pos2);
                if( distanceSqr < 100*100 )
                {
                    if(item.type === 2)
                    {
                        if(!wood || wood.rotationAngle < item.rotationAngle)
                            wood = item;

                        woodPile++;
                    }
                    else if(item.type === 1)
                        stone = item;
                }
            }

            if(collectible.type === 1)
            {
                if(wood) vec3.set(wood.position, collectible.position);

                if(stone != null)
                {
                    if(woodPile < woodReq)
                    {
                        t.showMessage("I think i need more fuel.", t.msgTime);
                    }
                    else
                    {
                        t.qteAction = function(){
                            if(t.fire)
                            {
                                var scale = t.fire.scale[1];
                                scale += 1;
                                t.fire.setScale(scale);
                            }
                            else
                            {
                                t.fire = t.spawnFire(stone, true, 2);
                            }
                        };

                        t.state = 2;
                        t.qteTime = 0;
                        t.addQte(0,5);

                    }
                }

            }
            else if(collectible.type === 2 && wood)
            {
                collectible.rotationAngle = $.r()*$.PI*2;
                vec3.set(wood.position, collectible.position);
            }
            else
            {
                collectible.velocity = vec3.subtract(t.player.position,t.eyePoint,vec3.create());
                vec3.scale(collectible.velocity, 0.20);
            }

            collectible.setParent(null);
            t.player.item = null;

            return;
        }

        var closest = null;
        var closestDist = Infinity;
        for(var i=0; i<t.drawList.length;i++)
        {
            if(!t.drawList[i].physics)
                continue;

            var distanceSqr = vec3.distanceSqr(t.drawList[i].position, t.player.position);
            if( !closest || closestDist > distanceSqr )
            {
                closest = t.drawList[i];
                closestDist = distanceSqr;
            }
        }

        if( closest && closestDist < 300*300 )
        {
            if(closest.type === 3)
                t.showMessage("Ouch! Too hot!", t.msgTime);
            else
            {
                if(closest.type === 2)
                    t.showMessage("I wonder if that would burn?", t.msgTime);
                else if(closest.type === 1)
                    t.showMessage("If I hit it on another one...", t.msgTime);

                closest.setParent(t.player);
                closest.rotationAngle = 0;
                t.player.item = closest;
            }
        }
    };

    t.lockPointer = function()
    {

        document.body.requestPointerLock = document.body['requestPointerLock'] ||
            document.body['mozRequestPointerLock'] ||
            document.body['webkitRequestPointerLock'];
        // Ask the browser to lock the pointer
        if(!t.noMouseLock) document.body.requestPointerLock();
    };

    t.rotateViewAround = function(deltaAngle, axis, v) {
        var frontDirection = vec3.create();
        vec3.subtract(t.lookAtPoint, t.eyePoint, frontDirection);
        vec3.normalize(frontDirection);
        var q = mat4.create();
        mat4.identity(q);
        mat4.rotate(q, deltaAngle, axis, q);
        mat4.multiplyVec3(q, frontDirection, frontDirection);
        t.lookAtPoint = vec3.create(t.eyePoint);
        vec3.add(t.lookAtPoint, frontDirection);
    };

    t.rotateView = function(x, y) {
        var frontDirection = vec3.create();
        var strafeDirection = vec3.create();
        vec3.subtract(t.lookAtPoint, t.eyePoint, frontDirection);
        vec3.normalize(frontDirection);
        vec3.cross(frontDirection, t.upVector, strafeDirection);
        vec3.normalize(strafeDirection);
        t.rotateViewAround(-x/360.0, t.upVector);
        t.rotateViewAround(-y/360.0, strafeDirection);
    };

    t.showMessage('Loading...');
    var this_ = this;
    setTimeout(function(){this_.initGame()},1);
}

function Input()
{
    var t = this;
    t._down = {};
    t._pressed = {};

    t.LEFT = 37;
    t.UP = 38;
    t.RIGHT = 39;
    t.DOWN = 40;
    t.SPACE = 32;
    t.R = 82;
    t.E = 69;
    t.U = 85;
    t.Q = 81;
    t.W = 87;
    t.A = 83;
    t.S = 65;
    t.D = 68;
    t.M = 77;
    t.mouse = -1;

    t.wasPressed = function(keyCode)
    {
        var released = t._pressed[keyCode];
        delete t._pressed[keyCode];
        return released;
    };

    t.isDown = function(keyCode)
    {
        return t._down[keyCode];
    };

    t.onKeydown = function(event)
    {

        if(!t._down[event.keyCode])
            t._pressed[event.keyCode] = true;
        t._down[event.keyCode] = true;
    };

    t.onKeyup = function(event)
    {
        if(t._down[event.keyCode])
            delete t._down[event.keyCode];
    };
};

(function(){
    var tId = setInterval(function() {
        if (document.readyState == "complete") onComplete();
    }, 11);

    function onComplete(){
        clearInterval(tId);
        var game = new Game();

        function update() {
            if(game.initialized) game.update();
            requestAnimationFrame(update);
        }

        requestAnimationFrame(update);

    };
})();

