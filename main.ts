/*
DESIGN GOALS:
-Below a certain speed, the controls are normal and snappy like you'd expect
-Above that threshhold, you enter 'break mode' - controls get more slippery and you need to maintain velocity
*/

//playervars
let xdamper = 5
let xaccel = 150
let breakspeedcap = 150 //threshhold under normal circumstances
let absspeedcap = 300 //the absolute speed limit
let lastdir = 1

//weapon
let currentcooldown = 0
let cooldown = 15
let weaponspeed = 200
let canshoot = true

//ability 1: burst jump
let burstjumpstartingcharge = 100
let burstjumpcharge = burstjumpstartingcharge
let maxburstjumpcharge = 200
let burstjumpchargerate = 5
let hasburstjumped = false
let chargingburst = false
enum buttonstates {notpressed, risingedge, held, fallingedge}
let abuttonstate = buttonstates.notpressed
let burstresettimer = 0
let burstresetrequiredtime = 2



//setup sprite kinds (this extends the default makecode ones)
namespace SpriteKind {
    export const Upgrade = SpriteKind.create()
}

//setup pickups
enum upgradetypes {boost, burst, tempcharge, total}
enum tempchargetypes {} //todo: come up with temporary abilities



//define functions

function handlebuttonstate_press(statevariable: any) {
    if (statevariable == buttonstates.notpressed) { //from not pressed
        statevariable = buttonstates.risingedge
    } else if (statevariable = buttonstates.risingedge) { //from just being pressed
        statevariable = buttonstates.held
    }
}
//effectively an extended version of moveSprite engineered for this game
function movesprite_gradient(sprite: Sprite, dx: number) {
    let inputx = controller.dx(dx) //input scaled with speed
    if (Math.sign(inputx) != 0) {
        lastdir = Math.sign(inputx) //last direction pressed
    }
    let breakModeActive: boolean = Math.abs(spr_player.vx) > breakspeedcap //whether or not break mode is in effect
    console.log(breakModeActive)
    if (inputx != 0) { //yes, dpad IS pressed
        if (breakModeActive) { //BREAK MODE ACCEL
            if (Math.abs(sprite.vx + inputx) <= absspeedcap) {
                sprite.vx += inputx //accelerate to speedcap
            } else {
                sprite.vx = Math.sign(sprite.vx) * absspeedcap //maintain speedcap
            }
        } else { //NON-BREAK ACCEL
            sprite.vx = breakspeedcap * Math.sign(inputx)
        }
    } else { //no, dpad IS NOT pressed
        if (breakModeActive) {
            if (Math.abs(sprite.vx) >= Math.abs((lastdir * Math.sign(sprite.vx)) + (Math.sign(sprite.vx) * xdamper))) { //if greater than or equal to the damping value
                sprite.vx -= Math.sign(sprite.vx) * xdamper //reduce by damping value
            } else {
                sprite.vx = 0 //otherwise, zero it out manually to avoid overshooting into perpetuity
            }
        } else {
            sprite.vx = 0 //zero it out immediately - no break mode, no accel to worry about
        }
    }
    if (chargingburst) {
        sprite.vx *= .25
        sprite.vy *= .25
    }
}
//a function to automatically handle charging up burst
function burstcharge() {
    if (burstjumpcharge < maxburstjumpcharge) {
        burstjumpcharge += burstjumpchargerate
    }
    let burstjumpnote = burstjumpcharge / maxburstjumpcharge * 500
    music.playTone(burstjumpnote, 13)
}
//a seperate jump function that gets run from main; also handles burst
function player_jump() {
    if (controller.A.isPressed()) {
        //button state management
        if (abuttonstate == buttonstates.notpressed) { //from not pressed
            abuttonstate = buttonstates.risingedge
        } else if (abuttonstate = buttonstates.risingedge) { //from just being pressed
            abuttonstate = buttonstates.held
        }

        if (spr_player.vy == 0) {
            spr_player.vy = -155
        } else if (!hasburstjumped && abuttonstate == buttonstates.risingedge){
            //burst jump code
            chargingburst = true
            burstcharge()
        } else if (chargingburst) {
            burstcharge()
        }
    } else { //release burst charge
        //button state management
        if (abuttonstate == buttonstates.held) { //from being held
            abuttonstate = buttonstates.fallingedge
        } else if (abuttonstate = buttonstates.fallingedge) { //from just being released
            abuttonstate = buttonstates.notpressed
        }

        if (chargingburst) {
            music.smallCrash.play()
            chargingburst = false
            hasburstjumped = true
            spr_player.vy = burstjumpcharge * -1
            burstjumpcharge = burstjumpstartingcharge
            burstresettimer = 0
        }
    }
    if (spr_player.vy == 0) { //reset burst
        if (burstresettimer < burstresetrequiredtime) { //if current burst timer is less than required
            burstresettimer += 1
            if (burstresettimer < burstresetrequiredtime) {//remember to set it to true if the timer is done
                hasburstjumped = false
            }
        }
    }
}
//shoot lmao
function player_shoot() {
    if (controller.B.isPressed() && canshoot && currentcooldown <= 0) {
        let prj_playerbullet = sprites.createProjectileFromSprite(img`
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . f f . . . . . . .
            . . . . . . f 1 1 f . . . . . .
            . . . . . . f 1 1 f . . . . . .
            . . . . . . . f f . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
        `, spr_player, spr_player.vx + (lastdir * weaponspeed), 0)
        canshoot = false
        currentcooldown = cooldown
    } else {
        canshoot = true
        if (currentcooldown > 0) {
            currentcooldown -= 1
        }
    }
}
//the big function for all the abilities; currently, just boost
function player_ability_activate() {
    if (controller.down.isPressed()) {
        music.bigCrash.play()
        spr_player.vx = absspeedcap * lastdir //boost
    }
}

//setup player
let spr_player: Sprite = sprites.create(img`
    f f f f f f f f f f f f f f f f 
    f . . . . . . . . . . . . . . f 
    f . . . . . . . . . . . . . . f 
    f . . . . . . . . . . . . . . f 
    f . . . . . . . . . . . . . . f 
    f . . . . . . . . . . . . . . f 
    f . . . . . . . . . . . . . . f 
    f . . . . . . . . . . . . . . f 
    f . . . . . . . . . . . . . . f 
    f . . . . . . . . . . . . . . f 
    f . . . . . . . . . . . . . . f 
    f . . . . . . . . . . . . . . f 
    f . . . . . . . . . . . . . . f 
    f . . . . . . . . . . . . . . f 
    f . . . . . . . . . . . . . . f 
    f f f f f f f f f f f f f f f f 
    `, SpriteKind.Player)
spr_player.ay = 350
scene.cameraFollowSprite(spr_player)
tiles.placeOnRandomTile(spr_player, assets.tile`tl_spawn`)

//lights, camera, action
scene.setBackgroundColor(1)
tiles.setTilemap(tilemap`lvl_testroom`)
music.sonar.play()
color.setPalette(color.GrayScale)
lantern.startLanternEffect(spr_player)
lantern.setBreathingEnabled(false)
lantern.setLightBandWidth(21)
effects.blizzard.startScreenEffect()

game.onUpdate(function() {
    player_jump()
    player_ability_activate()
    player_shoot()
    movesprite_gradient(spr_player, xaccel)
    console.log(spr_player.vx)
})