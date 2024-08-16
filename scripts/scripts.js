import { world, EquipmentSlot, DyeColor, system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

world.beforeEvents.playerBreakBlock.subscribe((event) => {
    if (!event.block.getComponent("inventory") && !event.block.typeId.endsWith("wall_sign")) return;
    const itemStack = event.player.getComponent("minecraft:equippable").getEquipment(EquipmentSlot.Mainhand);
    const shopComp = getChestShop(event.block.location);
    if (itemStack?.typeId == "minecraft:golden_hoe" && event.block.typeId.endsWith("wall_sign")) {
        event.cancel = true;
        if (!shopComp) {
            let sucess = false;
            const fre = [{ x: 0, z: 1 }, { x: 0, z: -1 }, { x: 1, z: 0 }, { x: -1, z: 0 }];
            for (const { x, z } of fre) {
                if (x == 0 && z == 0) continue;
                const block = event.player.dimension.getBlock({ x: event.block.location.x + x, y: event.block.location.y, z: event.block.location.z + z });
                if (block.typeId == "minecraft:chest") {
                    system.run(() => {
                        createUI (event.player, event.block.location, block.location)
                    })
                    sucess = true
                    break
                }
            }
            if (!sucess) {
                system.run(() => {
                    event.player.sendMessage("§b§l[Cube§eCS]§r §cChest not found")
                })
            }
        } else {
            if (shopComp.playerId == event.player.id || event.player.hasTag("cubecs:admin")) {
                if (event.player.isSneaking) {
                        system.run(() => {
                        event.player.sendMessage("§b§l[Cube§eCS]§r §cChest Shop removed")
                        removeChestShop (shopComp);
                        event.block.getComponent("sign").setText("")
                        event.block.getComponent("sign").setWaxed(false)
                    })
                } else {
                    system.run(() => {
                        event.player.sendMessage("§b§l[Cube§eCS]§r §cShift + Destroy the sign remove your Chest Shop")
                        syncSign(event.player, shopComp.signLocation)
                    })
                }
            } else {
                system.run(() => {
                    syncSign(event.player, shopComp.signLocation)
                    event.player.sendMessage("§b§l[Cube§eCS]§r §cYou are not the owner of this Chest Shop")
                })
            }
        }
    } else {
        const isSHOPCHEST = world.getDynamicPropertyIds().some(id => {
            if (id.startsWith("chest_shop_")) {
                const shop = JSON.parse(world.getDynamicProperty(id));
                if (JSON.stringify(shop.chestLocation) == JSON.stringify(event.block.location)) {
                    return true;
                }
            }
        })
        if (isSHOPCHEST || shopComp) {
            event.cancel = true;
            system.run(() => {
                event.player.sendMessage("§b§l[Cube§eCS]§r §cYou cannot destroy the block of a Chest Shop")
                if (event.block.typeId.endsWith("wall_sign")) {
                    syncSign(event.player, shopComp.signLocation)
                }
            })
        }
    }
})

class ChestShop {
    constructor (playerName, playerId, itemNeeded, price, amount, sellingItem, signLocation, chestLocation) {
        this.playerName = playerName
        this.playerId = playerId
        this.itemNeeded = itemNeeded
        this.price = price
        this.amount = amount
        this.sellingItem = sellingItem
        this.signLocation = signLocation
        this.chestLocation = chestLocation
    }
    parse () {
        return {
            playerName: this.playerName,
            playerId: this.playerId,
            itemNeeded: this.itemNeeded,
            price: this.price,
            amount: this.amount,
            sellingItem: this.sellingItem,
            signLocation: this.signLocation,
            chestLocation: this.chestLocation
        }
    }
}

/** 
 * @param {import("@minecraft/server").Vector3} signLocation
 * @returns {ChestShop[]}
 */
function getChestShops () {
    return world.getDynamicPropertyIds().filter(id => id.startsWith("chest_shop_")).map(id => JSON.parse(world.getDynamicProperty(id)));
}

/**
 * @param {ChestShop} shop 
 */
function removeChestShop (shop) {
    const id = world.getDynamicPropertyIds().find(id => {
        const chestShop = JSON.parse(world.getDynamicProperty(id));
        if (JSON.stringify(chestShop.signLocation) == JSON.stringify(shop.signLocation)) {
            return true;
        } else {
            return false;
        }
    })
    world.setDynamicProperty(id)
}
/** 
 * @param {import("@minecraft/server").Vector3} signLocation
 * @returns {ChestShop}
 */
function getChestShop (signLocation) {
    return getChestShops().find(s => JSON.stringify(s.signLocation) == JSON.stringify(signLocation));
}

/**
 * @param {import("@minecraft/server").Player} player 
 * @param {import("@minecraft/server").Vector3} signLocation
 * @param {import("@minecraft/server").Vector3} chestLocation
 */
function createUI (player, signLocation, chestLocation) {
    new ModalFormData()
    .title("Create Chest Shop")
    .slider("Price", 1, 64, 1)
    .textField("Item Needed", "minecraft:air", "minecraft:air")
    .slider("Amount:", 1, 64, 1)
    .textField("Selling Item", "minecraft:air", "minecraft:air")
    .submitButton("Create")
    .show(player)
    .then(res => {
        if (res.canceled) return;
        const [price, itemNeeded, amount, sellingItem] = res.formValues;
        createShop(player, new ChestShop(player.name, player.id, itemNeeded, price, amount, sellingItem, signLocation, chestLocation))
    }).catch((error) => player.sendMessage(error.name + ":" + error.message + "\n" + error.stack))
}

/**
 * @param {import("@minecraft/server").Player} player 
 * @param {string} itemNeeded 
 * @param {number} price 
 * @param {string} type 
 * @param {number} amount 
 * @param {string} sellingItem
 * @param {import("@minecraft/server").Vector3} signLocation
 * @param {import("@minecraft/server").Vector3} chestLocation
 */
function createShop(player, chestShop) {
    let sucess = false;
    while (!sucess) {
        const readyId = `chest_shop_${Math.random()}_${player.id}`;
        if (!world.getDynamicProperty(readyId)) {
            world.setDynamicProperty(`chest_shop_${String(Math.random())}_${player.id}`, JSON.stringify(chestShop.parse()));
            sucess = true;
        }
    }
    player.sendMessage("§b§l[Cube§eCS]§r §aShop created!")
    syncSign(player, chestShop.signLocation)
}
/**
 * @param {import("@minecraft/server").Container} container
 * @param {string} typeId
 */
function getAmount (container, typeId) {
    let amount = 0;
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (!item) continue;
        if (item.matches(typeId)) amount += item.amount;
    }
    return amount
}
/**
 * @param {import("@minecraft/server").Container} container
 */
function getEmptySlot (container) {
    return container.emptySlotsCount;
}
/**
 * Synchronizes a sign with a chest shop.
 *
 * @param {import("@minecraft/server").Player} player - The player to synchronize the sign for.
 * @param {import("@minecraft/server").Vector3} signLocation - The location of the sign to synchronize.
 * @return {void}
 */
function syncSign (player, signLocation) {
    const shop = getChestShop(signLocation);
    if (!shop) return;
    /**
     * @type {import("@minecraft/server").Container}
     */
    const container = player.dimension.getBlock(shop.chestLocation).getComponent("inventory").container
    const itemLeft = Math.floor(getAmount(container, shop.sellingItem) / shop.amount);
    /**
     * @type {import("@minecraft/server").BlockSignComponent}
     */
    const sign = player.dimension.getBlock(shop.signLocation).getComponent("sign")
    sign.setWaxed(false)
    sign.setText(`§e${shop.sellingItem.split(":")[1]}\n§e${shop.itemNeeded.split(":")[1]}\n§l§bSell ${shop.amount}:${shop.price} Cost\n§r§a${itemLeft} available(s)`);
    sign.setWaxed(true)
}
/**
 * 
 * @param {import("@minecraft/server").Container} inventory 
 * @param {number} stackSize 
 * @returns 
 */
function checkInventory (inventory, stackSize, typeId) {
    let amount = 0;
    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item) {
            amount += stackSize;
            continue;
        } else {
            if (item.typeId == typeId) {
                amount += stackSize - item.amount;
            }
        }
    }
    return amount;
}
/**
 * 
 * @param {import("@minecraft/server").Container} container
 * @param {string} typeId
 */
function findItemMaxStack (container1, container2, typeId) {
    for (let i = 0; i < container1.size; i++) {
        const item = container1.getItem(i);
        if (!item) continue;
        if (item.matches(typeId)) {
            return item.maxStackSize
        }
    }
    for (let i = 0; i < container2.size; i++) {
        const item = container2.getItem(i);
        if (!item) continue;
        if (item.matches(typeId)) {
            return item.maxStackSize
        }
    }
    return 64
}

function getItemAmount (container, typeId) {
    let amount = 0;
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (!item) continue;
        if (item.matches(typeId)) amount += item.amount;
    }
    return amount
}

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    try {
    event.player.lastClick ??= 0;
    if (Date.now() - event.player.lastClick < 1000) return;
    event.player.lastClick = Date.now();
    if (event.block.typeId.endsWith("wall_sign")) {
        syncSign(event.block, event.block.location);
        const shop = getChestShop(event.block.location);
        if (!shop) return;
        const shopInv = event.player.dimension.getBlock(shop.chestLocation).getComponent("inventory").container
        const avaAmount = getAmount(shopInv, shop.sellingItem);
        if (avaAmount / shop.amount < 1) {
            event.player.sendMessage("§b§l[Cube§eCS]§r §cNot enough item to sell")
            return;
        }
        new ModalFormData()
            .title("Chest Shop | Made by jasonlaubb")
            .slider(`§gBuy Item(s): §e${shop.sellingItem} x${shop.amount}\n§gCost Item: §e${shop.itemNeeded} x${shop.price}\n§gBuy Amount§e`, 1, Math.floor(avaAmount / shop.price), 1, 1)
            .submitButton("Buy now!")
            .show(event.player)
            .then(res => {
                if (res.canceled) return;
                const [buyAmount] = res.formValues;
                const inv = event.player.getComponent("inventory").container
                if (buyAmount > getEmptySlot(inv)) {
                    event.player.sendMessage("§b§l[Cube§eCS]§r §cYou need to prepare an empty slot for each buy amount")
                    return;
                }
                const avaAmount2 = getAmount(shopInv, shop.sellingItem);
                if (avaAmount2 / shop.amount < 1) {
                    event.player.sendMessage("§b§l[Cube§eCS]§r §cNot enough item to sell")
                    return;
                }
                const maxStackSizeGive = findItemMaxStack(shopInv, inv, shop.itemNeeded);
                if (checkInventory(inv, maxStackSizeGive, shop.itemNeeded) < shop.amount * buyAmount) {
                    event.player.sendMessage("§b§l[Cube§eCS]§r §cShop is full of items!")
                    return;
                }

                const playerOwnAmount = getItemAmount(inv, shop.itemNeeded);

                const playerHasEnoughItem = playerOwnAmount >= shop.price * buyAmount

                if (!playerHasEnoughItem) {
                    event.player.sendMessage("§b§l[Cube§eCS]§r §cYou don't have enough item to buy")
                    return;
                }

                for (let i = 0; i < buyAmount; i++) {
                    for (let a = 0; a < shop.amount; a++) {
                        for (let v = 0; v < shopInv.size; v++) {
                            const item = shopInv.getItem(v);
                            if (!item) continue;
                            if (item.matches(shop.sellingItem)) {
                                const itemclone = item.clone();
                                if (item.amount > 1) {
                                    item.amount--;
                                    shopInv.setItem(v, item);
                                } else {
                                    shopInv.setItem(v);
                                }
                                itemclone.amount = 1;
                                inv.addItem(itemclone);
                                break;
                            }
                        }
                    }
                    for (let a = 0; a < shop.price; a++) {
                        for (let v = 0; v < inv.size; v++) {
                            const item = inv.getItem(v);
                            if (!item) continue;
                            if (item.matches(shop.itemNeeded)) {
                                const itemclone = item.clone();
                                if (item.amount > 1) {
                                    item.amount--;
                                    inv.setItem(v, item);
                                } else {
                                    inv.setItem(v);
                                }
                                itemclone.amount = 1;
                                shopInv.addItem(itemclone);
                                break;
                            }
                        }
                    }
                }

                syncSign(event.block, event.block.location);
                
            }).catch(error => {
                event.player.sendMessage("§b§l[Cube§eCS]§r §c" + error.name + ": " + error.message + "\n" + error.stack)
            })
    }
} catch (error) {
    world.sendMessage(error.name + ": " + error.message + "\n" + error.stack)
}
})
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    if (event.block.getComponent("inventory")) {
        const shopFound = world.getDynamicPropertyIds().map(id => world.getDynamicProperty(id)).find(s => {
            const shopK = JSON.parse(s);
            if (JSON.stringify(shopK.chestLocation) == JSON.stringify(event.block.location)) {
                return true;
            }
        })
        if (!shopFound) return;
        if (JSON.parse(shopFound).playerId != event.player.id && !event.player.hasTag("cubecs:admin")) {
            event.cancel = true;
            system.run(() => {
                event.player.sendMessage("§b§l[Cube§eCS]§r §cYou don't have enough permission to open the Chest Shop inventory")
            })
        }
    }
})
world.beforeEvents.explosion.subscribe((event) => {
    const shopsList = getChestShops().map(shop => [shop.chestLocation, shop.signLocation]);
    let oneArray = []
    for (let i = 0; i < shopsList.length; i++) {
        oneArray.push(JSON.stringify(shopsList[i][0]), JSON.stringify(shopsList[i][1]))
    }
    const impactBlock = event.getImpactedBlocks();
    if (impactBlock.some(block => oneArray.includes(JSON.stringify(block.location)))) {
        event.cancel = true
    }
})

world.afterEvents.worldInitialize(() => {
    world.sendMessage(`§b§l[Cube§eCS]§r §aChest Shop loaded | Made by jasonlaubb`)
})