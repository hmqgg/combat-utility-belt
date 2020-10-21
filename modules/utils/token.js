import { Sidekick } from "../sidekick.js";
import { NAME, SETTING_KEYS, DEFAULT_CONFIG, FLAGS } from "../butler.js";
import { MightySummoner } from "../mighty-summoner.js";

export class TokenUtility {
    /**
     * Hook on token create
     * @param {Object} scene
     * @param {Object} tokenData  
     * @param {Object} options 
     * @param {String} userId 
     * @todo move this to a preCreate hook to avoid a duplicate call to the db
     */
    static _onPreCreateToken(scene, tokenData, options, userId) {
        //const token = canvas.tokens.get(tokenData._id);
        const actor = game.actors.get(tokenData.actorId);
        const autoRollHP = Sidekick.getSetting(SETTING_KEYS.tokenUtility.autoRollHP);
        const mightySummonerSetting = Sidekick.getSetting(SETTING_KEYS.tokenUtility.mightySummoner);
        const mightySummonerFlag = getProperty(tokenData, `flags.${NAME}.${FLAGS.mightySummoner.mightySummoner}`);
        const tempCombatantSetting = Sidekick.getSetting(SETTING_KEYS.tempCombatants.enable);
        const tempCombatantFlag = getProperty(tokenData, `flags.${NAME}.${FLAGS.temporaryCombatants.temporaryCombatant}`);

        // if this token has been handled by the mighty summoner logic then nothing to do
        if (!actor || mightySummonerFlag || (tempCombatantSetting && tempCombatantFlag)) {
            return true;
        }

        const feat = Sidekick.getSetting(SETTING_KEYS.tokenUtility.mightySummonerFeat);

        if (mightySummonerSetting && MightySummoner._checkForFeat(actor, feat)) {
            MightySummoner._createDialog(tokenData, actor);
            return false;
        }
        
        if (tokenData.disposition !== -1 || !autoRollHP || actor?.hasPlayerOwner) {
            return true;
        }

        const formula = null;
        const newHP = TokenUtility.rollHP(actor, formula);
        const hpUpdate = TokenUtility._buildHPData(newHP);
        const newData = mergeObject(tokenData, hpUpdate);
        return newData;
    }

    /**
     * 
     * @param {*} scene 
     * @param {*} tokenData 
     * @param {*} options 
     * @param {*} userId 
     */
    static _onCreateToken(scene, tokenData, options, userId) {
        
    }

    

    /**
     * Rolls an actor's hp formula and returns an update payload with the result
     * @param {*} actor
     */
    static rollHP(actor, newFormula=null) {
        const formula = newFormula || getProperty(actor, "data.data.attributes.hp.formula");

        if (!formula) {
            return null;
        }
        
        const r = new Roll(formula);
        const roll = r.roll();
        const hideRoll = Sidekick.getSetting(SETTING_KEYS.tokenUtility.hideAutoRoll);

        roll.toMessage({
            flavor: `${actor.name} rolls for HP!`,
            rollMode: hideRoll ? `gmroll` : `roll`
        });
        const hp = r.total;
    
        return hp;
    }

    /**
     * For a given hp value, build an object with hp value and max set
     * @param {*} hp 
     */
    static _buildHPData(hp) {
        return {
            actorData: {
                data: {
                    attributes: {
                        hp: {
                            value: hp,
                            max: hp
                        }
                    }
                }
            }
        };
    }

    /**
     * Patch core methods
     */
    static patchCore() {
        Token.prototype._drawEffect = TokenUtility._drawEffect;
    }

    /**
     * Patch Core method: Token#_drawEffect
     * @param {*} src 
     * @param {*} i 
     * @param {*} bg 
     * @param {*} w 
     * @param {*} tint 
     */
    static async _drawEffect(src, i, bg, w, tint) {
        const effectSize = Sidekick.getSetting(SETTING_KEYS.tokenUtility.effectSize); 

        // Use the default values if no setting found
        const multiplier = effectSize ? DEFAULT_CONFIG.tokenUtility.effectSize[effectSize].multiplier : 2;
        const divisor = effectSize ? DEFAULT_CONFIG.tokenUtility.effectSize[effectSize].divisor : 5;
        
        // By default the width is multipled by 2, so divide by 2 first then use the new multiplier
        w = (w / 2) * multiplier;
        let tex = await loadTexture(src);
        let icon = this.effects.addChild(new PIXI.Sprite(tex));
        icon.width = icon.height = w;
        icon.x = Math.floor(i / divisor) * w;
        icon.y = (i % divisor) * w;
        if ( tint ) icon.tint = tint;
        bg.drawRoundedRect(icon.x + 1, icon.y + 1, w - 2, w - 2, 2);
        this.effects.addChild(icon);
      }
}