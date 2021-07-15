/*
DESIGN GOALS:
-Below a certain speed, the controls are normal and snappy like you'd expect
-Above that threshhold, you enter 'break mode' - controls get more slippery and you need to maintain velocity
*/

game.splash("This is an early build; 2/3 abilities are pre-unlocked and the map isn't finished by any means")

//unlocks
enum upgradetypes {none, gun, boost, burst, tempcharge, total}
enum tempchargetypes {none, total} //todo: come up with temporary abilities
let hasburst = true
let hasboost = true
let hasgun = false
let currenttempcharge = tempchargetypes.none

//playervars
let xdamper = 5
let xaccel = 150
let breakspeedcap = 150 //threshhold under normal circumstances
let absspeedcap = 300 //the absolute speed limit
let lastdir = 1
let energy = 100

//weapon
let currentcooldown = 0
let cooldown = 5
let weaponspeed = 200
let weapondamage = 1
let canshoot = true

//enemies
let enemyhealth = 3
let enemyattackcooldown = 30
let enemyattackspeed = 100
let enemydamage = 5
let enemysprite = assets.image`myImage0`

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

//ability 2: boost

//setup sprite kinds (this extends the default makecode ones)
namespace SpriteKind {
    export const Upgrade = SpriteKind.create()
    export const Shootable = SpriteKind.create()
    export const EnemyProjectile = SpriteKind.create()
}

//setup upgrades
class upgrade {
    upgradetype: upgradetypes
    tempchargetype: tempchargetypes
    spriteid: Sprite
    constructor(newtype: upgradetypes, newtempchargetype: tempchargetypes) {
        this.spriteid = sprites.create(img`
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
            . . 1 1 1 1 1 1 1 1 1 1 1 1 . .
            . . 1 . . . . . . . . . . 1 . .
            . . 1 . 1 1 1 1 1 1 1 1 . 1 . .
            . . 1 . 1 . . . . . . 1 . 1 . .
            . . 1 . 1 . 1 1 1 1 . 1 . 1 . .
            . . 1 . 1 . 1 . . 1 . 1 . 1 . .
            . . 1 . 1 . 1 . . 1 . 1 . 1 . .
            . . 1 . 1 . 1 1 1 1 . 1 . 1 . .
            . . 1 . 1 . . . . . . 1 . 1 . .
            . . 1 . 1 1 1 1 1 1 1 1 . 1 . .
            . . 1 . . . . . . . . . . 1 . .
            . . 1 1 1 1 1 1 1 1 1 1 1 1 . .
            . . . . . . . . . . . . . . . .
            . . . . . . . . . . . . . . . .
        `, SpriteKind.Upgrade)
        this.upgradetype = newtype
        this.tempchargetype = newtempchargetype
    }
    collect() {
        if (this.spriteid.overlapsWith(spr_player)) {
            music.sonar.play()
            switch(this.upgradetype) {
                case upgradetypes.gun:
                    hasgun = true
                    game.showLongText("You found the gun! Press B to shoot. It consumes your energy...", DialogLayout.Bottom)
                    break
                case upgradetypes.boost:
                    hasboost = true
                    game.showLongText("You found the boost! Press Down for a burst of speed. It consumes your energy...", DialogLayout.Bottom)
                    break
                case upgradetypes.burst:
                    hasburst = true
                    game.showLongText("You found the burst! Hold and release A mid-air to double jump.", DialogLayout.Bottom)
                    break
            }
            this.spriteid.destroy()
        }
    }
}

//setup shootables
enum shootabletypes {BreakableWall, Enemy, Boss}
class shootable {
    health: number
    spriteid: Sprite
    kind: shootabletypes
    attacktimer: number
    constructor(newhealth: number, spriteimage: Image, types: shootabletypes) {
        this.health = newhealth
        this.spriteid = sprites.create(spriteimage, SpriteKind.Shootable)
        this.kind = types
        this.attacktimer = enemyattackcooldown
    }
    hit(damageamount: number) {
        //wow this code was a terrible idea
        if (this.health > 0) { //dead enemies don't need to check if they're being hit
            let allprojectiles: Sprite[] = sprites.allOfKind(SpriteKind.Projectile)
            for(let i = 0; i < allprojectiles.length; i++) { //iterate through all projectiles
                if (this.spriteid.overlapsWith(allprojectiles[i])) { //check for collision with current projectile
                    allprojectiles[i].destroy()
                    if (damageamount >= this.health) {
                        this.health = 0
                        this.spriteid.destroy()
                        music.smallCrash.play()
                        energy += 10
                    } else {
                        this.health -= damageamount
                        music.thump.play()
                    }
                }
            }
        }
    }
    attack() {
        //console.log(this.health)
        if (this.health > 0) { //dead enemies don't shoot
            if (this.attacktimer == 0) {
                let enemyprojectile = sprites.create(img`
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
                `, SpriteKind.EnemyProjectile)
                enemyprojectile.x = this.spriteid.x
                enemyprojectile.y = this.spriteid.y
                enemyprojectile.vx = Math.sign(spr_player.x - this.spriteid.x) * enemyattackspeed
                enemyprojectile.setFlag(SpriteFlag.AutoDestroy, true)
                enemyprojectile.setFlag(SpriteFlag.DestroyOnWall, true)

                this.attacktimer = enemyattackcooldown
            } else {
                this.attacktimer -= 1
            }
        }
    }
    update() {
        this.hit(weapondamage)
        this.attack()
    }
}

//define functions
//manage button state progresssion from nothing -> rising edge -> held
function handlebuttonstate_press(statevariable: any) {
    if (statevariable == buttonstates.notpressed) { //from not pressed
        statevariable = buttonstates.risingedge
    } else if (statevariable = buttonstates.risingedge) { //from just being pressed
        statevariable = buttonstates.held
    }
    return statevariable
}
//manage button state progresssion from held -> falling edge -> nothing
function handlebuttonstate_release(statevariable: any) {
    if (statevariable == buttonstates.held) { //from being held
        statevariable = buttonstates.fallingedge
    } else if (statevariable = buttonstates.fallingedge) { //from just being released
        statevariable = buttonstates.notpressed
    }
    return statevariable
}
//effectively an extended version of moveSprite engineered for this game
function movesprite_gradient(sprite: Sprite, dx: number) {
    let inputx = controller.dx(dx) //input scaled with speed
    if (Math.sign(inputx) != 0) {
        lastdir = Math.sign(inputx) //last direction pressed
    }
    let breakModeActive: boolean = Math.abs(spr_player.vx) > breakspeedcap //whether or not break mode is in effect
    //console.log(breakModeActive)
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
function energy_decrement(cost: number) {
    if (cost >= energy) {
        energy = 0
        game.over(false)
    } else {
        energy -= cost
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
        abuttonstate = handlebuttonstate_press(abuttonstate)

        if (spr_player.vy == 0) {
            spr_player.vy = -155
        } else if (hasburst && !hasburstjumped && abuttonstate == buttonstates.risingedge){
            //burst jump code
            chargingburst = true
            spr_player.startEffect(effects.fire)
            burstcharge()
        } else if (hasburst && chargingburst) {
            burstcharge()
        }
    } else { //release burst charge
        //button state management
        abuttonstate = handlebuttonstate_release(abuttonstate)

        if (chargingburst) {
            music.smallCrash.play()
            effects.clearParticles(spr_player)
            spr_player.startEffect(effects.ashes)
            scene.cameraShake(4, 100)

            chargingburst = false
            hasburstjumped = true
            //energy_decrement(burstjumpcharge * .1)
            spr_player.vy = burstjumpcharge * -1
            burstjumpcharge = burstjumpstartingcharge
            burstresettimer = 0
        } else {
            effects.clearParticles(spr_player)
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
    if (hasgun) {
        if (controller.B.isPressed() && canshoot && currentcooldown <= 0) {
            music.knock.play()
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
            energy_decrement(1)
            canshoot = false
            currentcooldown = cooldown
        } else {
            canshoot = true
            if (currentcooldown > 0) {
                currentcooldown -= 1
            }
        }
    }
}
//the big function for all the abilities; currently, just boost
function player_ability_activate() {
    if (controller.down.isPressed()) {
        if (hasboost) {
            music.bigCrash.play()
            spr_player.vx = absspeedcap * lastdir //boost
        }
    } else {

    }
}
//HUD stuff
function updatehud() {
    spr_energy.x = spr_player.x - 56
    spr_energy.y = spr_player.y - 50
    spr_energy.setText(energy.toString())
    //console.log(energy)
}

//setup player
let spr_player: Sprite = sprites.create(img`
    f f f f f f f f f f f f f f f f
    f b b b b b b b b b b b b b b f
    f b b b b b b b b b b b b b b f
    f b b b b b b b b b b b b b b f
    f b b b b b b b b b b b b b b f
    f b b b b b b b b b b b b b b f
    f b b b b b b b b b b b b b b f
    f b b b b b b b b b b b b b b f
    f b b b b b b b b b b b b b b f
    f b b b b b b b b b b b b b b f
    f b b b b b b b b b b b b b b f
    f b b b b b b b b b b b b b b f
    f b b b b b b b b b b b b b b f
    f b b b b b b b b b b b b b b f
    f b b b b b b b b b b b b b b f
    f f f f f f f f f f f f f f f f
`, SpriteKind.Player)
spr_player.x = 872
spr_player.y = 136
spr_player.ay = 350
scene.cameraFollowSprite(spr_player)
tiles.placeOnRandomTile(spr_player, assets.tile`tl_spawn`)
let spr_energy: TextSprite = textsprite.create(energy.toString(), 1, 2)
//spr_energy.setOutline(1, color.rgb(0, 0, 0))
spr_energy.setBorder(1, color.rgb(0, 127, 127), 2)

//setup upgrades
//this is the worst solution i could have possibly come up with but it's not stupid if it works
let gunupgrade: upgrade = new upgrade(upgradetypes.gun, tempchargetypes.none)
gunupgrade.spriteid.x = 152
gunupgrade.spriteid.y = 408

//setup enemies
let allshootables: shootable[] = []
let enemyxpos = [458]
let enemyypos = [520]
for (let i = 0; i < enemyxpos.length; i++) {
    allshootables.push(new shootable(enemyhealth, enemysprite, shootabletypes.Enemy))
    allshootables[i].spriteid.x = enemyxpos[i]
    allshootables[i].spriteid.y = enemyypos[i]
}

//lights, camera, action
scene.setBackgroundColor(2)
tiles.setTilemap(tilemap`lvl_bigmap`)
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
    console.log(spr_player.x)
    console.log(spr_player.y)

    updatehud()

    gunupgrade.collect()

    for (let i = 0; i < allshootables.length; i++) {
        allshootables[i].update()
    }
})

//extra makecode functions
//enemy collisions (to stop cheese)
sprites.onOverlap(SpriteKind.Player, SpriteKind.Shootable, function(sprite: Sprite, otherSprite: Sprite) {
    energy_decrement(enemydamage)
    music.thump.play()
    sprite.vx = (lastdir * -1 * breakspeedcap) + 1
    sprite.vy = -5
})
//enemy projectiles
sprites.onOverlap(SpriteKind.Player, SpriteKind.EnemyProjectile, function(sprite: Sprite, otherSprite: Sprite) {
    energy_decrement(enemydamage)
    music.thump.play()
    otherSprite.destroy()
})