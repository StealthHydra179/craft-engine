/**
 * Creates a new event in a cross-browswer-compatible way.
 *
 * createEvent functionality is officially deprecated in favor of
 * the Event constructor, but some older browsers do not yet support
 * event constructors. Attempt to use the new functionality, fall
 * back to the old if it fails.
 *
 * @param {String} type
 * @param {boolean} [bubbles=false]
 * @param {boolean} [cancelable=false]
 */
createEvent = function createEvent(type, bubbles = false, cancelable = false) {
  var customEvent;
  try {
    customEvent = new Event(type, { bubbles, cancelable });
  } catch (e) {
    customEvent = document.createEvent('Event');
    customEvent.initEvent(type, bubbles, cancelable);
  }
  return customEvent;
};

bisect = function bisect(array, conditional) {
  const positive = array.filter(x => conditional(x));
  const negative = array.filter(x => !conditional(x));
  return [positive, negative];
};
function getCodeOrgAPI(controller) {
  return {
    /**
     * Called before a list of user commands will be issued.
     */
    startCommandCollection: function () {
      if (controller.DEBUG) {
        console.log("Collecting commands.");
      }
    },

    /**
     * Called when an attempt should be started, and the entire set of
     * command-queue API calls have been issued.
     *
     * @param {Function} onAttemptComplete - callback with two parameters,
     * "success", i.e., true if attempt was successful (level completed),
     * false if unsuccessful (level not completed), and the current level model.
     * @return {Promise.<boolean>} a promise for a success value when
     *   attempt is complete.
     */
    startAttempt: function (onAttemptComplete) {
      return new Promise(resolve => {
        controller.OnCompleteCallback = (...args) => {
          // Note: onAttemptComplete is unused in this repo, but it's
          // part of a public API - it'll be a breaking change to remove it.
          onAttemptComplete && onAttemptComplete(...args);
          resolve(args[0]);
        };
        controller.setPlayerActionDelayByQueueLength();
        controller.queue.begin();
        controller.run();
        controller.attemptRunning = true;
        controller.resultReported = false;
      });
    },

    resetAttempt: function () {
      controller.reset();
      controller.queue.reset();
      controller.OnCompleteCallback = null;
      controller.attemptRunning = false;
    },

    /**
     * @param highlightCallback
     * @param codeBlockCallback - for example:
     *  (e) => {
     *    if (e.type !== 'blockDestroyed') {
     *      return;
     *    }
     *
     *    if (e.blockType !== '[dropdown value, e.g. logOak') {
     *      return;
     *    }
     *
     *    evalUserCode(e.block);
     *  }
     */
    registerEventCallback(highlightCallback, codeBlockCallback) {
      // TODO(bjordan): maybe need to also handle top-level event block highlighting
      controller.events.push(codeBlockCallback);

      // in controller:
      // this.events.forEach((e) => e({ type: EventType.BLOCK_DESTROYED, blockType: 'logOak' });
      // (and clear out on reset)
    },

    onEventTriggered: function (highlightCallback, type, eventType, callback) {
      this.registerEventCallback(highlightCallback,
        function (event) {
          if (event.eventType === eventType && event.targetType === type) {
            callback(event);
          }
        }
      );
    },

    // helper functions for event
    isEventTriggered: function (event, eventType) {
      return (event.eventType === eventType);
    },

    // command list
    moveDirection: function (highlightCallback, targetEntity, direction) {
      controller.addCommand(new MoveDirectionCommand(controller, highlightCallback, targetEntity, direction), targetEntity);
    },

    moveForward: function (highlightCallback, targetEntity, onFinish) {
      controller.addCommand(new MoveForwardCommand(controller, highlightCallback, targetEntity, onFinish), targetEntity);
    },

    moveBackward: function (highlightCallback, targetEntity) {
      controller.addCommand(new MoveBackwardCommand(controller, highlightCallback, targetEntity), targetEntity);
    },

    moveAway: function (highlightCallback, targetEntity, moveAwayFrom) {
      const callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.moveAway(callbackCommand, moveAwayFrom);
      }, targetEntity);
      controller.addCommand(callbackCommand);
    },

    moveToward: function (highlightCallback, targetEntity, moveTowardTo) {
      const callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.moveToward(callbackCommand, moveTowardTo);
      }, targetEntity);
      controller.addCommand(callbackCommand);
    },

    flashEntity: function (highlightCallback, targetEntity) {
      const callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.flashEntity(callbackCommand);
      }, targetEntity);
      controller.addCommand(callbackCommand);
    },

    explodeEntity: function (highlightCallback, targetEntity) {
      const callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.explodeEntity(callbackCommand);
      }, targetEntity);
      controller.addCommand(callbackCommand);
    },

    use: function (highlightCallback, targetEntity) {
      const callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.use(callbackCommand, targetEntity);
      }, targetEntity);
      controller.addCommand(callbackCommand);
    },

    playSound: function (highlightCallback, sound, targetEntity) {
      const callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.playSound(callbackCommand, sound);
      }, targetEntity);
      controller.addCommand(callbackCommand);
    },

    turn: function (highlightCallback, direction, targetEntity, onFinish) {
      const callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.turn(callbackCommand, direction === 'right' ? 1 : -1);
      }, targetEntity, onFinish);
      controller.addCommand(callbackCommand);
    },

    turnRandom: function (highlightCallback, targetEntity) {
      const callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.turnRandom(callbackCommand);
      }, targetEntity);
      controller.addCommand(callbackCommand);
    },

    turnRight: function (highlightCallback, targetEntity, onFinish) {
      this.turn(highlightCallback, 'right', targetEntity, onFinish);
    },

    turnLeft: function (highlightCallback, targetEntity, onFinish) {
      this.turn(highlightCallback, 'left', targetEntity, onFinish);
    },

    destroyBlock: function (highlightCallback, targetEntity) {
      const callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.destroyBlock(callbackCommand);
      }, targetEntity);
      controller.addCommand(callbackCommand);
    },

    placeBlock: function (highlightCallback, blockType, targetEntity) {
      controller.addCommand(new PlaceBlockCommand(controller, highlightCallback, blockType, targetEntity), targetEntity);
    },

    placeDirection: function (highlightCallback, blockType, targetEntity, direction) {
      controller.addCommand(new PlaceDirectionCommand(controller, highlightCallback, blockType, targetEntity, direction), targetEntity, direction);
    },

    placeInFront: function (highlightCallback, blockType, targetEntity) {
      controller.addCommand(new PlaceInFrontCommand(controller, highlightCallback, blockType, targetEntity), targetEntity);
    },

    tillSoil: function (highlightCallback, targetEntity) {
      controller.addCommand(new PlaceInFrontCommand(controller, highlightCallback, 'watering', targetEntity));
    },

    ifBlockAhead: function (highlightCallback, blockType, targetEntity, codeBlock) {
      controller.addCommand(new IfBlockAheadCommand(controller, highlightCallback, blockType, targetEntity, codeBlock), targetEntity);
    },
    // -1 for infinite repeat
    repeat: function (highlightCallback, codeBlock, iteration, targetEntity) {
      controller.addCommand(new RepeatCommand(controller, highlightCallback, codeBlock, iteration, targetEntity));
    },
    // -1 for infinite repeat
    repeatRandom: function (highlightCallback, codeBlock, targetEntity) {
      var maxIteration = 10;
      var randomIteration = Math.floor(Math.random() * maxIteration) + 1;
      controller.addCommand(new RepeatCommand(controller, highlightCallback, codeBlock, randomIteration, targetEntity));
    },

    getScreenshot: function () {
      return controller.getScreenshot();
    },

    spawnEntity: function (highlightCallback, type, spawnDirection) {
      var callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.spawnEntity(callbackCommand, type, spawnDirection);
      });
      controller.addCommand(callbackCommand);
    },
    spawnEntityAt: function (highlightCallback, type, spawnX, spawnY, spawnDirection) {
      var callbackCommand=new CallbackCommand(controller,highlightCallback,() => {
        controller.spawnEntityAt(callbackCommand,type,spawnX,spawnY, spawnDirection);
      });
      controller.addCommand(callbackCommand);
    },
    destroyEntity: function (highlightCallback, targetEntity) {
      var callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.destroyEntity(callbackCommand, targetEntity);
      }, targetEntity);
      controller.addGlobalCommand(callbackCommand);
    },

    drop: function (highlightCallback, itemType, targetEntity) {
      var callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.drop(callbackCommand, itemType);
      }, targetEntity);
      controller.addCommand(callbackCommand);
    },

    startDay: function (highlightCallback) {
      var callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.startDay(callbackCommand);
      });
      controller.addGlobalCommand(callbackCommand);
    },

    startNight: function (highlightCallback) {
      var callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.startNight(callbackCommand);
      });
      controller.addGlobalCommand(callbackCommand);
    },

    wait: function (highlightCallback, time, targetEntity) {
      var callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.wait(callbackCommand, time);
      }, targetEntity);
      controller.addGlobalCommand(callbackCommand);
    },

    attack: function (highlightCallback, targetEntity) {
      var callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.attack(callbackCommand);
      }, targetEntity);
      controller.addCommand(callbackCommand);
    },

    setDayNightCycle: function (firstDelay, delayInSecond,  startTime) {
      if (!controller.dayNightCycle) {
        controller.dayNightCycle = true;
        controller.initiateDayNightCycle(firstDelay, delayInSecond, startTime);
      }
    },

    addScore: function (highlightCallback, score, targetEntity) {
      var callbackCommand = new CallbackCommand(controller, highlightCallback, () => {
        controller.addScore(callbackCommand, score);
      }, targetEntity);
      controller.addGlobalCommand(callbackCommand);
    },

    arrowDown: function (direction) {
      controller.arrowDown(direction);
    },

    arrowUp: function (direction) {
      controller.arrowUp(direction);
    },

    clickDown: function () {
      controller.clickDown();
    },

    clickUp: function () {
      controller.clickUp();
    }
  };
};
EventType = Object.freeze({
  WhenTouched : 0,
  WhenUsed : 1,
  WhenSpawned : 2,
  WhenAttacked : 3,
  WhenNight : 4,
  WhenDay : 5,
  WhenNightGlobal : 6,
  WhenDayGlobal : 7,
  WhenRun : 8
});
const FacingDirection = Object.freeze({
  North: 0,
  East: 1,
  South: 2,
  West: 3,

  opposite: function (facing) {
    switch (facing) {
      case FacingDirection.North: return FacingDirection.South;
      case FacingDirection.South: return FacingDirection.North;
      case FacingDirection.East: return FacingDirection.West;
      case FacingDirection.West: return FacingDirection.East;
    }
  },

  left: function (facing) {
    return this.turn(facing, 'left');
  },

  right: function (facing) {
    return this.turn(facing, 'right');
  },

  turnDirection: function (from, to) {
    switch (from) {
      case FacingDirection.North: return to === FacingDirection.East ? 'right' : 'left';
      case FacingDirection.South: return to === FacingDirection.West ? 'right' : 'left';
      case FacingDirection.East: return to === FacingDirection.South ? 'right' : 'left';
      case FacingDirection.West: return to === FacingDirection.North ? 'right' : 'left';
    }
  },

  turn: function (facing, rotation) {
    return (facing + 4 + (rotation === 'right' ? 1 : -1)) % 4;
  },

  directionToOffset: function (direction) {
    switch (direction) {
      case FacingDirection.North: return [0, -1];
      case FacingDirection.South: return [0, 1];
      case FacingDirection.East: return [1, 0];
      case FacingDirection.West: return [-1, 0];
    }
  },

  directionToRelative(direction) {
    switch (direction) {
      case FacingDirection.North: return "Up";
      case FacingDirection.South: return "Down";
      case FacingDirection.East: return "Right";
      case FacingDirection.West: return "Left";
    }
  }

});

const {
  North,
  South,
  East,
  West,
} = FacingDirection;
const directions = [
  FacingDirection.North,
  FacingDirection.East,
  FacingDirection.South,
  FacingDirection.West
];

class Position {

  constructor(x, y) {
    this.x = x;
    this.y = y;

    // Temporarily shadow x and y under array indices, for backwards
    // compatibility with old [x, y] position arrays.
    // TODO elijah: remove this once we are fully converted over to actual
    // Position instances
    this[0] = x;
    this[1] = y;
  }

  static add(left, right) {
    return new Position(left[0] + right[0], left[1] + right[1]);
  }

  static subtract(left, right) {
    return new Position(left[0] - right[0], left[1] - right[1]);
  }

  static equals(left, right) {
    return left[0] === right[0] && left[1] === right[1];
  }

  static directionToOffsetPosition(direction) {
    const offset = FacingDirection.directionToOffset(direction);
    if (offset) {
      return Position.fromArray(offset);
    }
  }

  static isAdjacent(left, right) {
    return directions
      .map(Position.directionToOffsetPosition)
      .some(offset => Position.equals(Position.add(left, offset), right));
  }

  static forward(position, direction) {
    return Position.add(position, Position.directionToOffsetPosition(direction));
  }

  static north(position) {
    return Position.forward(position, FacingDirection.North);
  }

  static east(position) {
    return Position.forward(position, FacingDirection.East);
  }

  static south(position) {
    return Position.forward(position, FacingDirection.South);
  }

  static west(position) {
    return Position.forward(position, FacingDirection.West);
  }

  static getOrthogonalPositions(position) {
    return directions.map(direction => Position.forward(position, direction));
  }

  static manhattanDistance(left, right) {
    const d1 = Math.abs(right.x - left.x);
    const d2 = Math.abs(right.y - left.y);
    return d1 + d2;
  }

  static absoluteDistanceSquare(left, right) {
    return Math.pow(left[0] - right[0], 2) + Math.pow(left[1] - right[1], 2);
  }

  /**
   * Gets all eight surrounding positions - orthogonal and diagonal
   */
  static getSurroundingPositions(position) {
    return Position.getOrthogonalPositions(position).concat([
      Position.north(Position.east(position)),
      Position.north(Position.west(position)),
      Position.south(Position.east(position)),
      Position.south(Position.west(position)),
    ]);
  }

  /**
   * A simple factory method to create Position instances from old [x, y]
   * position arrays. While we are transitioning fully to Position instances,
   * this can be used to easily convert from the old form to the new form. Once
   * we have finished transitioning, this should exclusively be used to parse
   * position arrays in initial level data into Position instances, and all code
   * should be using only Position instances.
   */
  static fromArray(position) {
    return new Position(position[0], position[1]);
  }
};
/**
 * Converts entities found within the levelConfig.actionPlane to a
 * levelConfig.entities suitable for loading by the game initializer.
 *
 * ['sheepRight', 'creeperUp] -> [['sheep', 0, 0, 1], ['creeper', 1, 0, 0]]
 *
 * @param levelConfig
 */
convertActionPlaneEntitiesToConfig = function (levelConfig) {
  const [width, height] = levelConfig.gridWidth && levelConfig.gridHeight ?
    [levelConfig.gridWidth, levelConfig.gridHeight] : [10, 10];

  var planesToCustomize = [levelConfig.actionPlane];
  planesToCustomize.forEach(function (plane) {
    for (let i = 0; i < plane.length; i++) {
      const x = i % width;
      const y = Math.floor(i / height);
      const entity = convertNameToEntity(plane[i], x, y);

      if (entity) {
        levelConfig.entities = levelConfig.entities || [];
        levelConfig.entities.push(entity);
        plane[i] = '';
      }
    }
  });
};

randomInt = function (min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
};

const suffixToDirection = {
  Up: FacingDirection.North,
  Down: FacingDirection.South,
  Left: FacingDirection.West,
  Right: FacingDirection.East,
};

convertNameToEntity = function (item, x, y) {
  if (item.match(/^(sheep|zombie|ironGolem|creeper|cod|cow|chicken|dolphin|ghast|boat|salmon|squid|tropicalFish|seaTurtle)(Right|Left|Up|Down|$)/)) {
    const directionMatch = item.match(/(.*)(Right|Left|Up|Down)/);
    const directionToUse = directionMatch ?
      suffixToDirection[directionMatch[2]] : FacingDirection.East;
    const entityToUse = directionMatch ? directionMatch[1] : item;
    return [entityToUse, x, y, directionToUse];
  }
};
class AssetLoader {
  constructor(controller) {
    this.controller = controller;
    this.audioPlayer = controller.audioPlayer;
    this.game = controller.game;
    this.assetRoot = controller.assetRoot;

    this.assets = {
      entityShadow: {
        type: 'image',
        path: `${this.assetRoot}images/Character_Shadow.png`
      },
      selectionIndicator: {
        type: 'image',
        path: `${this.assetRoot}images/Selection_Indicator.png`
      },
      finishOverlay: {
        type: 'image',
        path: `${this.assetRoot}images/WhiteRect.png`
      },
      underwaterOverlay: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Water_Caustics.png`,
        jsonPath: `${this.assetRoot}images/Water_Caustics.json`
      },
      bed: {
        type: 'image',
        path: `${this.assetRoot}images/Bed.png`
      },
      playerSteve: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Steve1013.png`,
        jsonPath: `${this.assetRoot}images/Steve1013.json`
      },
      playerAlex: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Alex1013.png`,
        jsonPath: `${this.assetRoot}images/Alex1013.json`
      },
      playerSteveEvents: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Steve_2016.png`,
        jsonPath: `${this.assetRoot}images/Steve_2016.json`
      },
      playerAlexEvents: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/DevAlex.png`,
        jsonPath: `${this.assetRoot}images/DevAlex.json`
      },
      playerAgent: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Agent.png`,
        jsonPath: `${this.assetRoot}images/Agent.json`
      },
      playerSteveAquatic: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Steve_2018.png`,
        jsonPath: `${this.assetRoot}images/Steve_2018.json`
      },
      playerAlexAquatic: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Alex_2018.png`,
        jsonPath: `${this.assetRoot}images/Alex_2018.json`
      },
      AO: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/AO.png`,
        jsonPath: `${this.assetRoot}images/AO.json`
      },
      LavaGlow: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/LavaGlow.png`,
        jsonPath: `${this.assetRoot}images/LavaGlow.json`
      },
      WaterAO: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/WaterAO.png`,
        jsonPath: `${this.assetRoot}images/WaterAO.json`
      },
      blockShadows: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Block_Shadows.png`,
        jsonPath: `${this.assetRoot}images/Block_Shadows.json`
      },
      undergroundFow: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/UndergroundFoW.png`,
        jsonPath: `${this.assetRoot}images/UndergroundFoW.json`
      },
      blocks: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Blocks.png`,
        jsonPath: `${this.assetRoot}images/Blocks.json`
      },
      leavesAcacia: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Leaves_Acacia_Decay.png`,
        jsonPath: `${this.assetRoot}images/Leaves_Acacia_Decay.json`
      },
      leavesBirch: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Leaves_Birch_Decay.png`,
        jsonPath: `${this.assetRoot}images/Leaves_Birch_Decay.json`
      },
      leavesJungle: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Leaves_Jungle_Decay.png`,
        jsonPath: `${this.assetRoot}images/Leaves_Jungle_Decay.json`
      },
      leavesOak: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Leaves_Oak_Decay.png`,
        jsonPath: `${this.assetRoot}images/Leaves_Oak_Decay.json`
      },
      leavesSpruce: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Leaves_Spruce_Decay.png`,
        jsonPath: `${this.assetRoot}images/Leaves_Spruce_Decay.json`
      },
      leavesSpruceSnowy: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Leaves_Spruce_Snowy_Decay.png`,
        jsonPath: `${this.assetRoot}images/Leaves_Spruce_Snowy_Decay.json`
      },
      sheep: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Sheep_2016.png`,
        jsonPath: `${this.assetRoot}images/Sheep_2016.json`
      },
      crops: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Crops.png`,
        jsonPath: `${this.assetRoot}images/Crops.json`
      },
      torch: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Torch.png`,
        jsonPath: `${this.assetRoot}images/Torch.json`
      },
      destroyOverlay: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Destroy_Overlay.png`,
        jsonPath: `${this.assetRoot}images/Destroy_Overlay.json`
      },
      blockExplode: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/BlockExplode.png`,
        jsonPath: `${this.assetRoot}images/BlockExplode.json`
      },
      miningParticles: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/MiningParticles.png`,
        jsonPath: `${this.assetRoot}images/MiningParticles.json`
      },
      miniBlocks: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Miniblocks.png`,
        jsonPath: `${this.assetRoot}images/Miniblocks.json`
      },
      lavaPop: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/LavaPop.png`,
        jsonPath: `${this.assetRoot}images/LavaPop.json`
      },
      redstoneSparkle: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Redstone_Sparkle.png`,
        jsonPath: `${this.assetRoot}images/Redstone_Sparkle.json`
      },
      fire: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Fire.png`,
        jsonPath: `${this.assetRoot}images/Fire.json`
      },
      bubbles: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Bubbles.png`,
        jsonPath: `${this.assetRoot}images/Bubbles.json`
      },
      explosion: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Explosion.png`,
        jsonPath: `${this.assetRoot}images/Explosion.json`
      },
      door: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Door.png`,
        jsonPath: `${this.assetRoot}images/Door.json`
      },
      doorIron: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Door_Iron.png`,
        jsonPath: `${this.assetRoot}images/Door_Iron.json`
      },
      rails: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Rails.png`,
        jsonPath: `${this.assetRoot}images/Rails.json`
      },
      tnt: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/TNT.png`,
        jsonPath: `${this.assetRoot}images/TNT.json`
      },
      burningInSun: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/BurningInSun.png`,
        jsonPath: `${this.assetRoot}images/BurningInSun.json`
      },
      zombie: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Zombie.png`,
        jsonPath: `${this.assetRoot}images/Zombie.json`
      },
      ironGolem: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Iron_Golem.png`,
        jsonPath: `${this.assetRoot}images/Iron_Golem.json`
      },
      creeper: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Creeper_2016.png`,
        jsonPath: `${this.assetRoot}images/Creeper_2016.json`
      },
      cow: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Cow.png`,
        jsonPath: `${this.assetRoot}images/Cow.json`
      },
      chicken: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Chicken.png`,
        jsonPath: `${this.assetRoot}images/Chicken.json`
      },
      cod: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/entities/Cod_2018.png`,
        jsonPath: `${this.assetRoot}images/entities/Cod_2018.json`
      },
      dolphin: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/entities/Dolphin_2018.png`,
        jsonPath: `${this.assetRoot}images/entities/Dolphin_2018.json`
      },
      ghast: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/Ghast.png`,
        jsonPath: `${this.assetRoot}images/Ghast.json`
      },
      salmon: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/entities/Salmon_2018.png`,
        jsonPath: `${this.assetRoot}images/entities/Salmon_2018.json`
      },
      seaTurtle: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/entities/Sea_Turtle_2018.png`,
        jsonPath: `${this.assetRoot}images/entities/Sea_Turtle_2018.json`
      },
      squid: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/entities/Squid_2018.png`,
        jsonPath: `${this.assetRoot}images/entities/Squid_2018.json`
      },
      tropicalFish: {
        type: 'atlasJSON',
        pngPath: `${this.assetRoot}images/entities/Tropical_Fish_2018.png`,
        jsonPath: `${this.assetRoot}images/entities/Tropical_Fish_2018.json`
      },
      dig_wood1: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/dig_wood1.mp3`,
        wav: `${this.assetRoot}audio/dig_wood1.wav`,
        ogg: `${this.assetRoot}audio/dig_wood1.ogg`
      },
      stepGrass: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/step_grass1.mp3`,
        wav: `${this.assetRoot}audio/step_grass1.wav`,
        ogg: `${this.assetRoot}audio/step_grass1.ogg`
      },
      stepWood: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/wood2.mp3`,
        ogg: `${this.assetRoot}audio/wood2.ogg`
      },
      stepStone: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/stone2.mp3`,
        ogg: `${this.assetRoot}audio/stone2.ogg`
      },
      stepGravel: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/gravel1.mp3`,
        ogg: `${this.assetRoot}audio/gravel1.ogg`
      },
      stepFarmland: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/cloth4.mp3`,
        ogg: `${this.assetRoot}audio/cloth4.ogg`
      },
      failure: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/break.mp3`,
        ogg: `${this.assetRoot}audio/break.ogg`
      },
      success: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/levelup.mp3`,
        ogg: `${this.assetRoot}audio/levelup.ogg`
      },
      fall: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/fallsmall.mp3`,
        ogg: `${this.assetRoot}audio/fallsmall.ogg`
      },
      fuse: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/fuse.mp3`,
        ogg: `${this.assetRoot}audio/fuse.ogg`
      },
      explode: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/explode3.mp3`,
        ogg: `${this.assetRoot}audio/explode3.ogg`
      },
      placeBlock: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/cloth1.mp3`,
        ogg: `${this.assetRoot}audio/cloth1.ogg`
      },
      collectedBlock: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/pop.mp3`,
        ogg: `${this.assetRoot}audio/pop.ogg`
      },
      bump: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/hit3.mp3`,
        ogg: `${this.assetRoot}audio/hit3.ogg`
      },
      punch: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/cloth1.mp3`,
        ogg: `${this.assetRoot}audio/cloth1.ogg`
      },
      fizz: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/fizz.mp3`,
        ogg: `${this.assetRoot}audio/fizz.ogg`
      },
      doorOpen: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/door_open.mp3`,
        ogg: `${this.assetRoot}audio/door_open.ogg`
      },
      houseSuccess: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/launch1.mp3`,
        ogg: `${this.assetRoot}audio/launch1.ogg`
      },
      minecart: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/minecartBase.mp3`,
        ogg: `${this.assetRoot}audio/minecartBase.ogg`
      },
      sheepBaa: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/say3.mp3`,
        ogg: `${this.assetRoot}audio/say3.ogg`
      },
      chickenHurt: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/chickenhurt2.mp3`,
        ogg: `${this.assetRoot}audio/chickenhurt2.ogg`
      },
      chickenBawk: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/chickensay3.mp3`,
        ogg: `${this.assetRoot}audio/chickensay3.ogg`
      },
      cowHuff: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/cowhuff.mp3`,
        ogg: `${this.assetRoot}audio/cowhuff.ogg`
      },
      cowHurt: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/cowhurt.mp3`,
        ogg: `${this.assetRoot}audio/cowhurt.ogg`
      },
      cowMoo: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/cowmoo1.mp3`,
        ogg: `${this.assetRoot}audio/cowmoo1.ogg`
      },
      cowMooLong: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/cowmoolong.mp3`,
        ogg: `${this.assetRoot}audio/cowmoolong.ogg`
      },
      creeperHiss: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/creeper.mp3`,
        ogg: `${this.assetRoot}audio/creeper.ogg`
      },
      ironGolemHit: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/irongolemhit.mp3`,
        ogg: `${this.assetRoot}audio/irongolemhit.ogg`
      },
      metalWhack: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/metalwhack.mp3`,
        ogg: `${this.assetRoot}audio/metalwhack.ogg`
      },
      zombieBrains: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/zombiebrains.mp3`,
        ogg: `${this.assetRoot}audio/zombiebrains.ogg`
      },
      zombieGroan: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/zombiegroan.mp3`,
        ogg: `${this.assetRoot}audio/zombiegroan.ogg`
      },
      zombieHurt: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/zombiehurt1.mp3`,
        ogg: `${this.assetRoot}audio/zombiehurt1.ogg`
      },
      pistonIn: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/piston_in.mp3`,
        ogg: `${this.assetRoot}audio/piston_in.ogg`
      },
      zombieHurt2: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/zombiehurt2.mp3`,
        ogg: `${this.assetRoot}audio/zombiehurt2.ogg`
      },
      pistonOut: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/piston_out.mp3`,
        ogg: `${this.assetRoot}audio/piston_out.ogg`
      },
      portalAmbient: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/portal.mp3`,
        ogg: `${this.assetRoot}audio/portal.ogg`
      },
      portalTravel: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/travel_portal.mp3`,
        ogg: `${this.assetRoot}audio/travel_portal.ogg`
      },
      pressurePlateClick: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/pressurePlateClick.mp3`,
        ogg: `${this.assetRoot}audio/pressurePlateClick.ogg`
      },
      moan2: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/moan2.mp3`,
        ogg: `${this.assetRoot}audio/moan2.ogg`
      },
      moan3: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/moan3.mp3`,
        ogg: `${this.assetRoot}audio/moan3.ogg`
      },
      moan6: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/moan6.mp3`,
        ogg: `${this.assetRoot}audio/moan6.ogg`
      },
      moan7: {
        type: 'sound',
        mp3: `${this.assetRoot}audio/moan7.mp3`,
        ogg: `${this.assetRoot}audio/moan7.ogg`
      },

    };

    const ALL_SOUND_ASSETS = [
      'dig_wood1',
      'stepGrass',
      'stepWood',
      'stepStone',
      'stepGravel',
      'stepFarmland',
      'failure',
      'success',
      'fall',
      'fuse',
      'explode',
      'placeBlock',
      'collectedBlock',
      'bump',
      'punch',
      'fizz',
      'doorOpen',
      'minecart',
      'sheepBaa',
      'chickenHurt',
      'chickenBawk',
      'cowHuff',
      'cowHurt',
      'cowMoo',
      'cowMooLong',
      'creeperHiss',
      'ironGolemHit',
      'metalWhack',
      'zombieBrains',
      'zombieGroan',
      'zombieHurt',
      'pistonIn',
      'pistonOut',
      'portalAmbient',
      'portalTravel',
      'pressurePlateClick',
      'moan2',
      'moan3',
      'moan6',
      'moan7',
    ];

    const CHICKEN_LEVEL_ASSETS = [
      'chicken',
      'entityShadow',
      'selectionIndicator',
      'AO',
      'blockShadows',
      'blocks',
      'miniBlocks',
      'stepGrass',
      'failure',
      'success',
    ].concat(ALL_SOUND_ASSETS);

    const ISLAND_LEVEL_ASSETS = [
      'entityShadow',
      'selectionIndicator',
      'finishOverlay',
      'AO',
      'WaterAO',
      'blockShadows',
      'blocks',
      'leavesJungle',
      'destroyOverlay',
      'blockExplode',
      'miningParticles',
      'miniBlocks',
      'bubbles',
      'dig_wood1',
      'stepGrass',
      'stepWood',
      'stepStone',
      'stepGravel',
      'failure',
      'success',
      'fall',
      'placeBlock',
      'collectedBlock',
      'bump',
      'punch',
    ];

    this.assetPacks = {
      adventurerLevelOneAssets: [
        'entityShadow',
        'selectionIndicator',
        'AO',
        'blockShadows',
        'leavesOak',
        'leavesBirch',
        'blocks',
        'sheep',
        'bump',
        'stepGrass',
        'failure',
        'success'
      ],
      adventurerLevelTwoAssets: [
        'entityShadow',
        'selectionIndicator',
        'AO',
        'blockShadows',
        'leavesSpruce',
        'blocks',
        'sheep',
        'bump',
        'stepGrass',
        'failure',
        'playerSteve',
        'success',
        'miniBlocks',
        'blockExplode',
        'miningParticles',
        'destroyOverlay',
        'dig_wood1',
        'collectedBlock',
        'punch',
      ],
      adventurerLevelThreeAssets: [
        'entityShadow',
        'selectionIndicator',
        'AO',
        'blockShadows',
        'leavesOak',
        'blocks',
        'sheep',
        'bump',
        'stepGrass',
        'failure',
        'playerSteve',
        'success',
        'miniBlocks',
        'blockExplode',
        'miningParticles',
        'destroyOverlay',
        'dig_wood1',
        'collectedBlock',
        'sheepBaa',
        'punch',
      ],
      adventurerAllAssetsMinusPlayer: [
        'entityShadow',
        'selectionIndicator',
        'finishOverlay',
        'bed',
        'AO',
        'LavaGlow',
        'WaterAO',
        'blockShadows',
        'undergroundFow',
        'blocks',
        'leavesAcacia',
        'leavesBirch',
        'leavesOak',
        'leavesSpruce',
        'sheep',
        'creeper',
        'crops',
        'torch',
        'destroyOverlay',
        'blockExplode',
        'miningParticles',
        'miniBlocks',
        'lavaPop',
        'fire',
        'bubbles',
        'explosion',
        'door',
        'rails',
        'tnt',
        'dig_wood1',
        'stepGrass',
        'stepWood',
        'stepStone',
        'stepGravel',
        'stepFarmland',
        'failure',
        'success',
        'fall',
        'fuse',
        'explode',
        'placeBlock',
        'collectedBlock',
        'bump',
        'punch',
        'fizz',
        'doorOpen',
        'houseSuccess',
        'minecart',
        'sheepBaa'
      ],
      levelOneAssets: CHICKEN_LEVEL_ASSETS,
      levelTwoAssets: CHICKEN_LEVEL_ASSETS,
      levelThreeAssets: CHICKEN_LEVEL_ASSETS,
      designerAllAssetsMinusPlayer: [
        'entityShadow',
        'selectionIndicator',
        'finishOverlay',
        'bed',
        'AO',
        'LavaGlow',
        'WaterAO',
        'blockShadows',
        'undergroundFow',
        'blocks',
        'leavesAcacia',
        'leavesBirch',
        'leavesJungle',
        'leavesOak',
        'leavesSpruce',
        'sheep',
        'creeper',
        'crops',
        'torch',
        'destroyOverlay',
        'blockExplode',
        'miningParticles',
        'miniBlocks',
        'lavaPop',
        'fire',
        'bubbles',
        'explosion',
        'door',
        'rails',
        'tnt',
        'dig_wood1',
        'stepGrass',
        'stepWood',
        'stepStone',
        'stepGravel',
        'stepFarmland',
        'failure',
        'success',
        'fall',
        'fuse',
        'explode',
        'placeBlock',
        'collectedBlock',
        'bump',
        'punch',
        'fizz',
        'doorOpen',
        'houseSuccess',
        'minecart',
        'sheepBaa',
        'zombie',
        'cow',
        'chicken',
        'ironGolem',
        'burningInSun',
        'chickenHurt',
        'chickenBawk',
        'cowHuff',
        'cowHurt',
        'cowMoo',
        'cowMooLong',
        'creeperHiss',
        'ironGolemHit',
        'metalWhack',
        'zombieBrains',
        'zombieGroan',
        'zombieHurt',
        'zombieHurt2',
      ],
      heroAllAssetsMinusPlayer: [
        'entityShadow',
        'selectionIndicator',
        'finishOverlay',
        'bed',
        'AO',
        'LavaGlow',
        'WaterAO',
        'blockShadows',
        'undergroundFow',
        'blocks',
        'leavesAcacia',
        'leavesBirch',
        'leavesOak',
        'leavesSpruce',
        'leavesSpruceSnowy',
        'sheep',
        'creeper',
        'crops',
        'torch',
        'destroyOverlay',
        'blockExplode',
        'miningParticles',
        'miniBlocks',
        'lavaPop',
        'redstoneSparkle',
        'fire',
        'bubbles',
        'explosion',
        'door',
        'doorIron',
        'rails',
        'tnt',
        'dig_wood1',
        'stepGrass',
        'stepWood',
        'stepStone',
        'stepGravel',
        'stepFarmland',
        'failure',
        'success',
        'fall',
        'fuse',
        'explode',
        'placeBlock',
        'collectedBlock',
        'bump',
        'punch',
        'fizz',
        'doorOpen',
        'houseSuccess',
        'minecart',
        'sheepBaa',
        'zombie',
        'cow',
        'chicken',
        'burningInSun',
        'ghast',
        'chickenHurt',
        'chickenBawk',
        'cowHuff',
        'cowHurt',
        'cowMoo',
        'cowMooLong',
        'creeperHiss',
        'metalWhack',
        'zombieBrains',
        'zombieGroan',
        'zombieHurt',
        'zombieHurt2',
        'pistonIn',
        'pistonOut',
        'portalAmbient',
        'portalTravel',
        'pressurePlateClick',
        'moan2',
        'moan3',
        'moan6',
        'moan7',
      ],
      aquaticIslandAssets: ISLAND_LEVEL_ASSETS,
      aquaticLevelThreeAndFourAssets: ISLAND_LEVEL_ASSETS.concat('cod', 'dolphin'),
      aquaticAllAssetsMinusPlayer: [
        'entityShadow',
        'selectionIndicator',
        'finishOverlay',
        'underwaterOverlay',
        'AO',
        'LavaGlow',
        'WaterAO',
        'lavaPop',
        'blockShadows',
        'undergroundFow',
        'blocks',
        'leavesJungle',
        'cod',
        'crops',
        'torch',
        'dolphin',
        'salmon',
        'seaTurtle',
        'squid',
        'tropicalFish',
        'destroyOverlay',
        'blockExplode',
        'miningParticles',
        'miniBlocks',
        'bubbles',
        'dig_wood1',
        'stepGrass',
        'stepWood',
        'stepStone',
        'stepGravel',
        'failure',
        'success',
        'fall',
        'placeBlock',
        'collectedBlock',
        'bump',
        'punch',
      ],
      allAssetsMinusPlayer: [
        'entityShadow',
        'selectionIndicator',
        'finishOverlay',
        'underwaterOverlay',
        'bed',
        'AO',
        'LavaGlow',
        'WaterAO',
        'blockShadows',
        'undergroundFow',
        'blocks',
        'cod',
        'dolphin',
        'salmon',
        'seaTurtle',
        'squid',
        'tropicalFish',
        'leavesAcacia',
        'leavesBirch',
        'leavesJungle',
        'leavesOak',
        'leavesSpruce',
        'leavesSpruceSnowy',
        'sheep',
        'creeper',
        'crops',
        'torch',
        'destroyOverlay',
        'blockExplode',
        'miningParticles',
        'miniBlocks',
        'lavaPop',
        'redstoneSparkle',
        'fire',
        'bubbles',
        'explosion',
        'door',
        'doorIron',
        'rails',
        'tnt',
        'dig_wood1',
        'stepGrass',
        'stepWood',
        'stepStone',
        'stepGravel',
        'stepFarmland',
        'failure',
        'success',
        'fall',
        'fuse',
        'explode',
        'placeBlock',
        'collectedBlock',
        'bump',
        'punch',
        'fizz',
        'doorOpen',
        'houseSuccess',
        'minecart',
        'sheepBaa',
        'zombie',
        'cow',
        'chicken',
        'ghast',
        'ironGolem',
        'burningInSun',
        'chickenHurt',
        'chickenBawk',
        'cowHuff',
        'cowHurt',
        'cowMoo',
        'cowMooLong',
        'creeperHiss',
        'ironGolemHit',
        'metalWhack',
        'zombieBrains',
        'zombieGroan',
        'zombieHurt',
        'zombieHurt2',
        'pistonIn',
        'pistonOut',
        'portalAmbient',
        'portalTravel',
        'pressurePlateClick',
        'moan2',
        'moan3',
        'moan6',
        'moan7',
      ],
      playerSteve: [
        'playerSteve'
      ],
      playerAlex: [
        'playerAlex'
      ],
      playerSteveEvents: [
        'playerSteveEvents'
      ],
      playerAlexEvents: [
        'playerAlexEvents'
      ],
      playerAgent: [
        'playerAgent'
      ],
      playerSteveAquatic: [
        'playerSteveAquatic'
      ],
      playerAlexAquatic: [
        'playerAlexAquatic'
      ],
    };
  }

  loadPacks(packList) {
    packList.forEach((packName) => {
      this.loadPack(packName);
    });
  }

  loadPack(packName) {
    let packAssets = this.assetPacks[packName];
    this.loadAssets(packAssets);
  }

  loadAssets(assetNames) {
    assetNames.forEach((assetKey) => {
      let assetConfig = this.assets[assetKey];
      this.loadAsset(assetKey, assetConfig);
    });
  }

  loadAsset(key, config) {
    switch (config.type) {
      case 'image':
        this.game.load.image(key, config.path);
        break;
      case 'sound':
        this.audioPlayer.register({
          id: key,
          mp3: config.mp3,
          ogg: config.ogg
        });
        break;
      case 'atlasJSON':
        this.game.load.atlasJSONHash(key, config.pngPath, config.jsonPath);
        break;
      default:
        throw `Asset ${key} needs config.type set in configuration.`;
    }
  }
};
class AStarPathFinding {
  constructor(model) {
    this.levelModel = model;

    this.grid = this.createGrid();
  }

  createGrid() {
    return this.levelModel.actionPlane.getAllPositions().map((position) => {
      return {
        position: position,
        cost: 1,    // cost is 1 so that all blocks are treated the same but could do something with lava, water.
        f: 0, g: 0, h: 0, visited: false, closed: false, parent: null
      };
    });
  }

  reset() {
    for (let i = 0; i < this.grid.length; i++) {
      let node = this.grid[i];
      node.f = 0;
      node.g = 0;
      node.h = 0;
      node.visited = false;
      node.closed = false;
      node.parent = null;
    }
  }

  getNode(position) {
    const index = this.levelModel.coordinatesToIndex(position);
    if (this.levelModel.inBounds(position) &&                        // is the node within bounds
        this.levelModel.actionPlane.getBlockAt(position).isEmpty &&  // is the node empty
        !this.grid[index].closed) {                                  // has the node already been processed.
      return this.grid[index];
    }
    return null;
  }

  getNeighbors(node) {
    let neighbors = [];
    const west = this.getNode(Position.west(node.position));
    const east = this.getNode(Position.east(node.position));
    const south = this.getNode(Position.south(node.position));
    const north = this.getNode(Position.north(node.position));

    // west
    if (west) {
      neighbors.push(west);
    }

    // east
    if (east) {
      neighbors.push(east);
    }

    // south
    if (south) {
      neighbors.push(south);
    }

    // north
    if (north) {
      neighbors.push(north);
    }
    return neighbors;
  }

  findPath(startPosition, endPosition) {
    // Ensure we are in a starting state.
    this.reset();

    const startIndex = this.levelModel.coordinatesToIndex(startPosition.position);
    const endIndex = this.levelModel.coordinatesToIndex(endPosition.position);

    const endNode = this.grid[endIndex];

    let openList = [];

    // Push the starting node node to begin the algorithm.
    openList.push(this.grid[startIndex]);
    while (openList.length > 0) {
      // Get lowest f-scored node.
      let lowestFindex = 0;
      for (let i = 0; i < openList.length; i++) {
        if (openList[i].f < openList[lowestFindex].f) {
          lowestFindex = i;
        }
      }
      let currentNode = openList[lowestFindex];

      // Check if we've reached target and return path.
      if (currentNode === endNode) {
        let node = currentNode;
        let path = [];
        while (node.parent) {
          path.push(node);
          node = node.parent;
        }
        return path.reverse();
      }

      // process the current node.
      openList.splice(lowestFindex, 1); // Remove the node from the open list.
      currentNode.closed = true; // Flag this node as closed...

      // Find all non-closed, valid neighbors for the current node.
      let neighbors = this.getNeighbors(currentNode);

      for (let i = 0; i < neighbors.length; i++) {
        let neighbor = neighbors[i];

        let gScore = currentNode.g + neighbor.cost;
        let dirtyFlag = false;

        if (!neighbor.visited) {
          // First time we've arrived at this node, must be a better path.
          dirtyFlag = true;

          neighbor.visited = true;
          neighbor.h = Position.manhattanDistance(neighbor.position, endNode.position);
          openList.push(neighbor);
        } else if (gScore < neighbor.g) {
          // We've already visited this node, but it now has a better score, let's try it again.
          dirtyFlag = true;
        }

        if (dirtyFlag) {
          neighbor.parent = currentNode;
          neighbor.g = gScore;
          neighbor.f = neighbor.g + neighbor.h;
        }
      }
    }

    // No path could be found, return empty array.
    return [];
  }
};
/**
 * Group an array of positions into sets of connected positions. Default
 * definition of "connected" is "orthogonally adjacent", but that can be
 * overridden.
 */
class AdjacencySet {
  /**
   * @param {Position[]} positions
   * @param {Function} [comparisonFunction = Position.isAdjacent]
   */
  constructor(positions, comparisonFunction) {
    this.comparisonFunction = comparisonFunction || Position.isAdjacent;
    this.sets = [];
    if (positions) {
      positions.forEach((position) => {
        this.add(position);
      });
    }
  }

  /**
   * Flatten the set of sets down to a single array of Positions
   *
   * @return {Position[]}
   */
  flattenSets() {
    return this.sets.reduce((acc, cur) => acc.concat(cur), []);
  }

  /**
   * Add a position to our adjacency sets if it doesn't already exist, updating
   * existing sets as necessary
   *
   * NOTE that this operation is O(N), not the O(1) that you would expect from
   * a full disjoint-set implementation.
   *
   * @param {Position} position
   * @return {boolean} whether or not the specified position was newly added
   */
  add(position) {
    if (this.find(position)) {
      return false;
    }

    const adjacent = this.sets.filter(set =>
      set.some(other => this.comparisonFunction(position, other))
    );
    if (adjacent.length === 1) {
      // if this position is adjacent to exactly one set, simply add it to the
      // set
      adjacent[0].push(position);
    } else if (adjacent.length > 1) {
      // if this position unites several new sets into one mutual adjacency,
      // combine them all and add this position to the new set
      const newSet = [];
      adjacent.forEach((s) => {
        this.sets.splice(this.sets.indexOf(s), 1);
        newSet.push(...s);
      });
      newSet.push(position);
      this.sets.push(newSet);
    } else {
      // if this position is all by itself, let it be the initial entry in a new
      // set
      this.sets.push([position]);
    }

    return true;
  }

  /**
   * Find the set containing a specified position, if it exists
   *
   * @return {(Postion[]|undefined)}
   */
  find(position) {
    return this.sets.find((set) => set.some((other) => Position.equals(position, other)));
  }

  /**
   * Remove a position from our adjacency sets if it exists, updating existing
   * sets as necessary.
   *
   * NOTE that this operation is O(N), not the O(1) that you would expect from
   * a full disjoint-set implementation.
   *
   * @param {Position} position
   * @return {boolean} whether or not the specified position existed in the sets
   */
  remove(position) {
    const containingSet = this.find(position);

    if (!containingSet) {
      return false;
    }

    this.sets.splice(this.sets.indexOf(containingSet), 1);
    const newSet = containingSet.filter((other) => !Position.equals(position, other));
    if (newSet.length) {
      const newSets = new AdjacencySet(newSet, this.comparisonFunction).sets;
      this.sets.push(...newSets);
    }
    return true;
  }
};

class BaseEntity {
  constructor(controller, type, identifier, x, y, facing) {
    this.queue = new CommandQueue(controller);
    this.controller = controller;
    this.game = controller.game;
    this.position = new Position(x, y);
    this.type = type;
    // temp
    this.facing = facing;
    // offset for sprite position in grid
    this.offset = [-22, -12];
    this.identifier = identifier;
    this.healthPoint = 3;
    this.underTree = { state: false, treeIndex: -1 };
  }

  tick() {
      this.queue.tick();
  }

  reset() {
  }

  canMoveThrough() {
    return false;
  }

  canPlaceBlock() {
    return false;
  }

  canTriggerPressurePlates() {
    return false;
  }

  /**
   * Whether or not the white "selection indicator" highlight square should
   * update to follow this entity around as it moves and interacts with the
   * world
   *
   * @return {boolean}
   */
  shouldUpdateSelectionIndicator() {
    return false;
  }

  setMovePosition(position) {
    this.position = position;
  }

  /**
   * For entities which need to be able to accomodate rendering in the same
   * cell as other entities, provide a way to define a rendering offset.
   *
   * @see LevelView.playPlayerAnimation
   * @see LevelView.playMoveForwardAnimation
   * @return Number
   */
  getSortOrderOffset() {
    return 5;
  }

  addCommand(commandQueueItem, repeat = false) {
    this.queue.addCommand(commandQueueItem, repeat);
    // execute the command
    this.queue.begin();
  }

  addAnimation(...args) {
    return this.getAnimationManager().add(...args);
  }

  getAnimationManager() {
    return this.animationRig ? this.animationRig.animations : this.sprite.animations;
  }

  getWalkAnimation() {
    return "walk" + this.controller.levelView.getDirectionName(this.facing);
  }

  getIdleAnimation() {
    return "idle" + this.controller.levelView.getDirectionName(this.facing);
  }

  playMoveForwardAnimation(position, facing, commandQueueItem, groundType) {
    var levelView = this.controller.levelView;
    var tween;
    // update z order
    var zOrderYIndex = position[1] + (facing === FacingDirection.North ? 1 : 0);
    this.sprite.sortOrder = this.controller.levelView.yToIndex(zOrderYIndex) + 1;
    // stepping sound
    levelView.playBlockSound(groundType);
    // play walk animation
    levelView.playScaledSpeed(this.getAnimationManager(), this.getWalkAnimation());
    setTimeout(() => {
      tween = this.controller.levelView.addResettableTween(this.sprite).to({
        x: (this.offset[0] + 40 * position[0]), y: (this.offset[1] + 40 * position[1])
      }, 300, Phaser.Easing.Linear.None);
      tween.onComplete.add(() => {
        levelView.playScaledSpeed(this.getAnimationManager(), this.getIdleAnimation());
        commandQueueItem.succeeded();
      });

      tween.start();
    }, 50 / this.controller.tweenTimeScale);
    // smooth movement using tween
  }

  /**
   * player walkable stuff
   */
  walkableCheck() {
    //do nothing
  }

    updateHidingTree() {
        var levelView = this.controller.levelView;
        // this is not under tree
        if (!this.underTree.state) {
            var treeList = levelView.trees;
            for (var i = 0; i < treeList.length; i++) {
                if (levelView.isUnderTree(i, this.position)) {
                    levelView.changeTreeAlpha(i, 0.8);
                    this.underTree = { state: true, treeIndex: i };
                    break;
                }
            }
            // this is under tree
        } else {
            var currentTreeIndex = this.underTree.treeIndex;
            var entities = this.controller.levelEntity.entityMap;
            var isOtherEntityUnderTree = function (currentEntity, entities, currentTreeIndex) {
                for (var value of entities) {
                    let entity = value[1];
                    const sameEntity = entity === currentEntity;
                    if (!sameEntity && entity.underTree.treeIndex === currentTreeIndex) {
                        return true;
                    }
                }
                return false;
            };
            if (!levelView.isUnderTree(currentTreeIndex, this.position)) {
                if (!isOtherEntityUnderTree(this, entities, currentTreeIndex)) {
                    levelView.changeTreeAlpha(currentTreeIndex, 1);
                }
                this.underTree = { state: false, treeIndex: -1 };
            }
        }
    }

    updateHidingBlock(prevPosition) {
        const levelView = this.controller.levelView;
        const actionPlane = this.controller.levelModel.actionPlane;

        let frontBlockCheck = function (entity, position) {
            let frontPosition = Position.south(position);
            const frontBlock = actionPlane.getBlockAt(frontPosition);
            if (frontBlock && !frontBlock.isTransparent) {
                var sprite = levelView.actionPlaneBlocks[levelView.coordinatesToIndex(frontPosition)];
                if (sprite !== null) {
                    var tween = entity.controller.levelView.addResettableTween(sprite).to({
                        alpha: 0.8
                    }, 300, Phaser.Easing.Linear.None);

                    tween.start();
                }
            }
        };

        let prevBlockCheck = function (entity, position) {
            let frontPosition = Position.south(position);
            if (frontPosition.y < 10) {
                var sprite = levelView.actionPlaneBlocks[levelView.coordinatesToIndex(frontPosition)];
                if (sprite !== null) {
                    var tween = entity.controller.levelView.addResettableTween(sprite).to({
                        alpha: 1
                    }, 300, Phaser.Easing.Linear.None);

                    tween.start();
                }
            }
        };

        if (!this.isOnBlock) {
            frontBlockCheck(this, this.position);
        }
        if (prevPosition !== undefined) {
            prevBlockCheck(this, prevPosition);
        }
    }

    doMoveForward(commandQueueItem, forwardPosition) {
        var levelModel = this.controller.levelModel;
        var prevPosition = this.position;
        this.position = forwardPosition;
        // play sound effect
        let groundType = levelModel.groundPlane.getBlockAt(this.position).blockType;
        // play move forward animation and play idle after that
        this.playMoveForwardAnimation(forwardPosition, this.facing, commandQueueItem, groundType, () => {
        });
        this.updateHidingTree();
        this.updateHidingBlock(prevPosition);
    }

    bump(commandQueueItem) {
        var animName = "bump";
        var facingName = this.controller.levelView.getDirectionName(this.facing);
        this.controller.levelView.playScaledSpeed(this.getAnimationManager(), animName + facingName);
        let forwardPosition = this.controller.levelModel.getMoveForwardPosition(this);
        let forwardEntity = this.controller.levelEntity.getEntityAt(forwardPosition);
        if (forwardEntity !== null) {
            this.queue.startPushHighPriorityCommands();
            this.controller.events.forEach(e => e({ eventType: EventType.WhenTouched, targetType: this.type, targetIdentifier: this.identifier, eventSenderIdentifier: forwardEntity.identifier }));
            this.queue.endPushHighPriorityCommands();
        }
        this.controller.delayPlayerMoveBy(400, 800, () => {
            commandQueueItem.succeeded();
        });
    }

    callBumpEvents(forwardPositionInformation) {
        for (var i = 1; i < forwardPositionInformation.length; i++) {
            if (forwardPositionInformation[i] === 'frontEntity') {
                this.controller.events.forEach(e => e({ eventType: EventType.WhenTouched, targetType: forwardPositionInformation[i + 1].type, eventSenderIdentifier: this.identifier, targetIdentifier: forwardPositionInformation[i + 1].identifier }));
                i++;
            }
        }
    }

    moveDirection(commandQueueItem, direction) {
        // update entity's direction
        this.controller.levelModel.turnToDirection(this, direction);
        this.moveForward(commandQueueItem, false);
    }

    moveForward(commandQueueItem, record = true) {
        if (record) {
            this.controller.addCommandRecord("moveForward", this.type, commandQueueItem.repeat);
        }
        let forwardPosition = this.controller.levelModel.getMoveForwardPosition(this);
        var forwardPositionInformation = this.controller.levelModel.canMoveForward(this);
        if (forwardPositionInformation[0]) {
            let offset = Position.directionToOffsetPosition(this.facing);
            let reverseOffset = Position.directionToOffsetPosition(FacingDirection.opposite(this.facing));
            let weMovedOnTo = this.handleMoveOnPressurePlate(offset);
            this.doMoveForward(commandQueueItem, forwardPosition);
            if (!weMovedOnTo) {
              this.handleMoveOffPressurePlate(reverseOffset);
            }
            this.handleMoveOffIronDoor(reverseOffset);
            this.handleMoveAwayFromPiston(reverseOffset);
        } else {
            this.bump(commandQueueItem);
            this.callBumpEvents(forwardPositionInformation);
        }
    }

    moveBackward(commandQueueItem, record = true) {
        if (record) {
            this.controller.addCommandRecord("moveBackward", this.type, commandQueueItem.repeat);
        }
        let backwardPosition = this.controller.levelModel.getMoveDirectionPosition(this, 2);
        var backwardPositionInformation = this.controller.levelModel.canMoveBackward(this);
        if (backwardPositionInformation[0]) {
            let offset = Position.directionToOffsetPosition(FacingDirection.opposite(this.facing));
            let reverseOffset = Position.directionToOffsetPosition(this.facing);
            let weMovedOnTo = this.handleMoveOnPressurePlate(offset);
            this.doMoveBackward(commandQueueItem, backwardPosition);
            if (!weMovedOnTo) {
              this.handleMoveOffPressurePlate(reverseOffset);
            }
            this.handleMoveOffIronDoor(reverseOffset);
            this.handleMoveAwayFromPiston(reverseOffset);
        } else {
            this.bump(commandQueueItem);
            this.callBumpEvents(backwardPositionInformation);
        }
    }

    /**
     * @typedef {Object} CanPlace
     * @property {boolean} canPlace - whether or not placement is allowed at all
     * @property {string} plane - which plane the block should be placed on. Can
     *                    be either "groundPlane" or "actionPlane"
     */

    /**
     * check whether or not the entity can place the given block on top of the
     * given block
     *
     * @param {LevelBlock} [toPlaceBlock]
     * @param {LevelBlock} [onTopOfBlock]
     * @return {CanPlace}
     */
    canPlaceBlockOver() {
      return { canPlace: false, plane: '' };
    }

    /**
     * check all the movable points and choose the farthest one
     *
     * @param {any} commandQueueItem
     * @param {any} moveAwayFrom (entity)
     *
     * @memberOf BaseEntity
     */
    moveAway(commandQueueItem, moveAwayFrom) {
        this.controller.addCommandRecord("moveAway", this.type, commandQueueItem.repeat);
        var moveAwayPosition = moveAwayFrom.position;
        var bestPosition = [];
        let comparePositions = function (moveAwayPosition, position1, position2) {
            return Position.absoluteDistanceSquare(position1[1], moveAwayPosition) < Position.absoluteDistanceSquare(position2[1], moveAwayPosition) ? position2 : position1;
        };

        var currentDistance = Position.absoluteDistanceSquare(moveAwayPosition, this.position);
        // this entity is on the right side and can move to right
        if (moveAwayPosition.x <= this.position.x && this.controller.levelModel.canMoveDirection(this, FacingDirection.East)[0]) {
            bestPosition = [FacingDirection.East, Position.east(this.position)];
        }
        // this entity is on the left side and can move to left
        if (moveAwayPosition.x >= this.position.x && this.controller.levelModel.canMoveDirection(this, FacingDirection.West)[0]) {
            if (bestPosition.length > 0) {
                bestPosition = comparePositions(moveAwayPosition, bestPosition, [FacingDirection.West, Position.west(this.position)]);
            } else {
                bestPosition = [FacingDirection.West, Position.west(this.position)];
            }
        }
        // this entity is on the up side and can move to up
        if (moveAwayPosition.y >= this.position.y && this.controller.levelModel.canMoveDirection(this, FacingDirection.North)[0]) {
            if (bestPosition.length > 0) {
                bestPosition = comparePositions(moveAwayPosition, bestPosition, [FacingDirection.North, Position.north(this.position)]);
            } else {
                bestPosition = [FacingDirection.North, Position.north(this.position)];
            }
        }
        // this entity is on the down side and can move to down
        if (moveAwayPosition.y <= this.position.y && this.controller.levelModel.canMoveDirection(this, FacingDirection.South)[0]) {
            if (bestPosition.length > 0) {
                bestPosition = comparePositions(moveAwayPosition, bestPosition, [FacingDirection.South, Position.south(this.position)]);
            } else {
                bestPosition = [FacingDirection.South, Position.south(this.position)];
            }
        }
        // terminate the action since it's impossible to move
        if (bestPosition.length === 0 || currentDistance >= Position.absoluteDistanceSquare(moveAwayPosition, bestPosition[1])) {
            commandQueueItem.succeeded();
        } else {
            // execute the best result
            this.moveDirection(commandQueueItem, bestPosition[0]);
        }
    }

    /**
     * check all the movable points and choose the farthest one
     *
     * @param {any} commandQueueItem
     * @param {any} moveTowardTo (entity)
     *
     * @memberOf BaseEntity
     */
    moveToward(commandQueueItem, moveTowardTo) {
        this.controller.addCommandRecord("moveToward", this.type, commandQueueItem.repeat);
        var moveTowardPosition = moveTowardTo.position;
        var bestPosition = [];
        let comparePositions = function (moveTowardPosition, position1, position2) {
          return Position.absoluteDistanceSquare(position1[1], moveTowardPosition) >
                 Position.absoluteDistanceSquare(position2[1], moveTowardPosition)
                   ? position2
                   : position1;
        };

        // this entity is on the right side and can move to right
        if (moveTowardPosition.x >= this.position.x && this.controller.levelModel.canMoveDirection(this, FacingDirection.East)[0]) {
            bestPosition = [FacingDirection.East, Position.east(this.position)];
        }
        // this entity is on the left side and can move to left
        if (moveTowardPosition.x <= this.position.x && this.controller.levelModel.canMoveDirection(this, FacingDirection.West)[0]) {
            if (bestPosition.length > 0) {
                bestPosition = comparePositions(moveTowardPosition, bestPosition, [FacingDirection.West, Position.west(this.position)]);
            } else {
                bestPosition = [FacingDirection.West, Position.west(this.position)];
            }
        }
        // this entity is on the up side and can move to up
        if (moveTowardPosition.y <= this.position.y && this.controller.levelModel.canMoveDirection(this, FacingDirection.North)[0]) {
            if (bestPosition.length > 0) {
                bestPosition = comparePositions(moveTowardPosition, bestPosition, [FacingDirection.North, Position.north(this.position)]);
            } else {
                bestPosition = [FacingDirection.North, Position.north(this.position)];
            }
        }
        // this entity is on the down side and can move to down
        if (moveTowardPosition.y >= this.position.y && this.controller.levelModel.canMoveDirection(this, FacingDirection.South)[0]) {
            if (bestPosition.length > 0) {
                bestPosition = comparePositions(moveTowardPosition, bestPosition, [FacingDirection.South, Position.south(this.position)]);
            } else {
                bestPosition = [FacingDirection.South, Position.south(this.position)];
            }
        }
        // terminate the action since it's impossible to move
        if (Position.absoluteDistanceSquare(this.position, moveTowardPosition) === 1) {
            if (this.position.x < moveTowardPosition.x) {
                this.facing = FacingDirection.East;
            } else if (this.position.x > moveTowardPosition.x) {
                this.facing = FacingDirection.West;
            } else if (this.position.y < moveTowardPosition.y) {
                this.facing = FacingDirection.South;
            } else if (this.position.y > moveTowardPosition.y) {
                this.facing = FacingDirection.North;
            }
            this.updateAnimationDirection();
            this.bump(commandQueueItem);
            return false;
        } else {
            if (bestPosition.length === 0) {
                commandQueueItem.succeeded();
                return false;
                // execute the best result
            } else {
                this.moveDirection(commandQueueItem, bestPosition[0]);
                return true;
            }
        }
    }


    moveTo(commandQueueItem, moveTowardTo) {
        if (Position.absoluteDistanceSquare(moveTowardTo.position, this.position) === 1) {
            /// north
            if (moveTowardTo.position.y - this.position.y === -1) {
                this.moveDirection(commandQueueItem, FacingDirection.North);
            } else if (moveTowardTo.position.y - this.position.y === 1) {
                this.moveDirection(commandQueueItem, FacingDirection.South);
            } else if (moveTowardTo.position.x - this.position.x === 1) {
                this.moveDirection(commandQueueItem, FacingDirection.East);
            } else {
                this.moveDirection(commandQueueItem, FacingDirection.West);
            }
        } else if (this.moveToward(commandQueueItem, moveTowardTo)) {
            var callbackCommand = new CallbackCommand(this.controller, () => { }, () => {
                this.moveTo(callbackCommand, moveTowardTo);
            }, this.identifier);
            this.addCommand(callbackCommand);
        } else {
            this.bump(commandQueueItem);
        }
    }

    turn(commandQueueItem, direction, record = true) {
        if (record) {
            this.controller.addCommandRecord("turn", this.type, commandQueueItem.repeat);
        }
        // update entity direction
        if (direction === -1) {
            this.controller.levelModel.turnLeft(this);
        }

        if (direction === 1) {
            this.controller.levelModel.turnRight(this);
        }
        // update animation
        this.updateAnimationDirection();
        this.controller.delayPlayerMoveBy(200, 800, () => {
            commandQueueItem.succeeded();
        });
    }

    turnRandom(commandQueueItem) {
        this.controller.addCommandRecord("turnRandom", this.type, commandQueueItem.repeat);
        var getRandomInt = function (min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        };
        var direction = getRandomInt(0, 1) === 0 ? 1 : -1;
        this.turn(commandQueueItem, direction, false);
    }

    use(commandQueueItem, userEntity) {
        // default behavior for use ?
        var animationName = "lookAtCam" + this.controller.levelView.getDirectionName(this.facing);
        this.controller.levelView.playScaledSpeed(this.getAnimationManager(), animationName);
        this.queue.startPushHighPriorityCommands();
        this.controller.events.forEach(e => e({ eventType: EventType.WhenUsed, targetType: this.type, eventSenderIdentifier: userEntity.identifier, targetIdentifier: this.identifier }));
        this.queue.endPushHighPriorityCommands();
        commandQueueItem.succeeded();
    }

    drop(commandQueueItem, itemType) {
        this.controller.addCommandRecord("drop", this.type, commandQueueItem.repeat);
        this.controller.levelView.playItemDropAnimation(this.position, itemType, () => {
            commandQueueItem.succeeded();

            if (this.controller.levelModel.usePlayer) {
                const playerCommand = this.controller.levelModel.player.queue.currentCommand;
                if (playerCommand && playerCommand.waitForOtherQueue) {
                    playerCommand.succeeded();
                }
            }
        });
    }

    attack(commandQueueItem) {
        this.controller.addCommandRecord("attack", this.type, commandQueueItem.repeat);
        let facingName = this.controller.levelView.getDirectionName(this.facing);
        this.controller.levelView.playScaledSpeed(this.getAnimationManager(), "attack" + facingName);
        setTimeout((entity) => {
            let frontEntity = entity.controller.levelEntity.getEntityAt(entity.controller.levelModel.getMoveForwardPosition(entity));
            if (frontEntity) {
                var callbackCommand = new CallbackCommand(entity.controller, () => { }, () => { frontEntity.takeDamage(callbackCommand); }, frontEntity);
                frontEntity.addCommand(callbackCommand);
            }
            setTimeout(function (controller, entity, thisEntity) {
                if (entity !== null) {
                    frontEntity.queue.startPushHighPriorityCommands();
                    controller.events.forEach(e => e({ eventType: EventType.WhenAttacked, targetType: entity.type, eventSenderIdentifier: thisEntity.identifier, targetIdentifier: entity.identifier }));
                    frontEntity.queue.endPushHighPriorityCommands();
                }
                commandQueueItem.succeeded();
            }, 300 / this.controller.tweenTimeScale, entity.controller, frontEntity, entity);
        }, 200 / this.controller.tweenTimeScale, this);
    }

    pushBack(commandQueueItem, pushDirection, movementTime, completionHandler) {
        var levelModel = this.controller.levelModel;
        var pushBackPosition = Position.forward(this.position, pushDirection);
        var canMoveBack = levelModel.isPositionEmpty(pushBackPosition)[0];
        if (canMoveBack) {
            this.updateHidingBlock(this.position);
            this.position = pushBackPosition;
            this.updateHidingTree();
            var tween = this.controller.levelView.addResettableTween(this.sprite).to({
                x: (this.offset[0] + 40 * this.position[0]), y: (this.offset[1] + 40 * this.position[1])
            }, movementTime, Phaser.Easing.Linear.None);
            tween.onComplete.add(() => {
                setTimeout(() => {
                    commandQueueItem.succeeded();
                    if (completionHandler !== undefined) {
                        completionHandler(this);
                    }
                }, movementTime  / this.controller.tweenTimeScale);
            });
            tween.start();
        } else {
            commandQueueItem.succeeded();
            if (completionHandler !== undefined) {
                completionHandler(this);
            }
        }
    }

    takeDamage(callbackCommand) {
        let levelView = this.controller.levelView;
        let facingName = levelView.getDirectionName(this.facing);
        if (this.healthPoint > 1) {
            levelView.playScaledSpeed(this.getAnimationManager(), "hurt" + facingName);
            setTimeout(() => {
                this.healthPoint--;
                callbackCommand.succeeded();
            }, 1500 / this.controller.tweenTimeScale);
        } else {
            this.healthPoint--;
            this.getAnimationManager().stop(null, true);
            this.controller.levelView.playScaledSpeed(this.getAnimationManager(), "die" + facingName);
            setTimeout(() => {
                var tween = this.controller.levelView.addResettableTween(this.sprite).to({
                    alpha: 0
                }, 300, Phaser.Easing.Linear.None);
                tween.onComplete.add(() => {
                    this.controller.levelEntity.destroyEntity(this.identifier);
                });
                tween.start();
            }, 1500 / this.controller.tweenTimeScale);
        }
    }

    playRandomIdle(facing) {
        var facingName,
            rand,
            animationName = "";
        facingName = this.controller.levelView.getDirectionName(facing);
        rand = Math.trunc(Math.random() * 5) + 1;

        switch (rand) {
            case 1:
                animationName += "idle";
                break;
            case 2:
                animationName += "lookLeft";
                break;
            case 3:
                animationName += "lookRight";
                break;
            case 4:
                animationName += "lookAtCam";
                break;
            case 5:
                animationName += "lookDown";
                break;
            default:
        }

        animationName += facingName;
        this.controller.levelView.playScaledSpeed(this.getAnimationManager(), animationName);
    }

    updateAnimationDirection() {
        let facingName = this.controller.levelView.getDirectionName(this.facing);
        this.controller.levelView.playScaledSpeed(this.getAnimationManager(), "idle" + facingName);
    }

    getDistance(entity) {
      return Position.absoluteDistanceSquare(this.position, entity.position);
    }

    blowUp(commandQueueItem, explosionPosition) {
        let pushBackDirection = FacingDirection.South;
        if (explosionPosition[0] > this.position[0]) {
            pushBackDirection = FacingDirection.West;
            this.facing = FacingDirection.East;
            this.updateAnimationDirection();
        } else if (explosionPosition[0] < this.position[0]) {
            pushBackDirection = FacingDirection.East;
            this.facing = FacingDirection.West;
            this.updateAnimationDirection();
        } else if (explosionPosition[1] > this.position[1]) {
            pushBackDirection = FacingDirection.North;
            this.facing = FacingDirection.South;
            this.updateAnimationDirection();
        } else if (explosionPosition[1] < this.position[1]) {
            pushBackDirection = FacingDirection.South;
            this.facing = FacingDirection.North;
            this.updateAnimationDirection();
        }
        this.pushBack(commandQueueItem, pushBackDirection, 150, function (entity) {
            let callbackCommand = new CallbackCommand(entity.controller, () => { }, () => { entity.controller.destroyEntity(callbackCommand, entity.identifier); }, entity.identifier);
            entity.queue.startPushHighPriorityCommands();
            entity.addCommand(callbackCommand, commandQueueItem.repeat);
            entity.queue.endPushHighPriorityCommands();
        });

    }

  hasPermissionToWalk(actionBlock, frontEntity, groundBlock = null) {
        return (actionBlock.isWalkable || ((frontEntity !== undefined && frontEntity.isOnBlock)
        // action plane is empty
        && !actionBlock.isEmpty))
        // there is no entity
        && (frontEntity === undefined || frontEntity.canMoveThrough())
        // no lava or water
        && (groundBlock.blockType !== "water" && groundBlock.blockType !== "lava");
  }

  handleMoveOffPressurePlate(moveOffset) {
    const previousPosition = Position.add(this.position, moveOffset);
    const isMovingOffOf = this.controller.levelModel.actionPlane.getBlockAt(previousPosition).blockType === "pressurePlateDown";
    const destinationBlock = this.controller.levelModel.actionPlane.getBlockAt(this.position);
    let remainOn = false;
    if (destinationBlock === undefined || !destinationBlock.isWalkable) {
      remainOn = true;
    }
    this.controller.levelEntity.entityMap.forEach((workingEntity) => {
      if (workingEntity.identifier !== this.identifier
      && workingEntity.canTriggerPressurePlates()
      && this.controller.positionEquivalence(workingEntity.position, previousPosition)) {
        remainOn = true;
      }
    });
    if (isMovingOffOf && !remainOn) {
      this.controller.audioPlayer.play("pressurePlateClick");
      const block = new LevelBlock('pressurePlateUp');
      this.controller.levelModel.actionPlane.setBlockAt(previousPosition, block, moveOffset[0], moveOffset[1]);
    }
  }

  handleMoveOnPressurePlate(moveOffset) {
    const targetPosition = Position.add(this.position, moveOffset);
    const isMovingOnToPlate = this.controller.levelModel.actionPlane.getBlockAt(targetPosition).blockType === "pressurePlateUp";
    if (isMovingOnToPlate) {
      this.controller.audioPlayer.play("pressurePlateClick");
      const block = new LevelBlock('pressurePlateDown');
      this.controller.levelModel.actionPlane.setBlockAt(targetPosition, block);
      return true;
    }
    return false;
  }

  handleMoveOffIronDoor(moveOffset) {
    const formerPosition = Position.add(this.position, moveOffset);
    if (!this.controller.levelModel.inBounds(formerPosition)) {
      return;
    }

    const wasOnDoor = this.controller.levelModel.actionPlane.getBlockAt(formerPosition).blockType === "doorIron";
    const isOnDoor = this.controller.levelModel.actionPlane.getBlockAt(this.position).blockType === "doorIron";
    if (wasOnDoor && !isOnDoor) {
      this.controller.levelModel.actionPlane.findDoorToAnimate(new Position(-1, -1));
    }
  }

  handleMoveAwayFromPiston(moveOffset) {
    const formerPosition = Position.add(this.position, moveOffset);
    Position.getOrthogonalPositions(formerPosition).forEach(workingPos => {
      if (this.controller.levelModel.actionPlane.inBounds(workingPos)) {
        const block = this.controller.levelModel.actionPlane.getBlockAt(workingPos);
        if (block.blockType.startsWith("piston") && block.isPowered) {
          this.controller.levelModel.actionPlane.activatePiston(workingPos);
        }
      }
    });
  }

  handleGetOnRails(direction) {
    this.getOffTrack = false;
    this.handleMoveOffPressurePlate(new Position(0, 0));
    this.controller.levelView.playTrack(this.position, direction, true, this, null);
  }
};
class Agent extends BaseEntity {
  constructor(controller, type, x, y, name, isOnBlock, facing) {
    super(controller, type, 'PlayerAgent', x, y, facing);
    this.offset = [-16, -15];
    this.name = name;
    this.isOnBlock = isOnBlock;
    this.inventory = {};
    this.movementState = -1;

    this.moveDelayMin = 20;
    this.moveDelayMax = 150;
  }

  /**
   * @override
   */
  canPlaceBlockOver(toPlaceBlock, onTopOfBlock) {
    let result = { canPlace: false, plane: '' };
    if (onTopOfBlock.getIsLiquid()) {
      if (toPlaceBlock.getIsPlaceableInLiquid()) {
        result.canPlace = true;
        result.plane = "groundPlane";
      }
    } else {
      if (toPlaceBlock.isWalkable) {
        result.canPlace = true;
        result.plane = "actionPlane";
      }
    }
    return result;
  }

  /**
   * @override
   */
  canPlaceBlock(block) {
    return block.isEmpty;
  }

  /**
   * @override
   */
  canMoveThrough() {
    return true;
  }

  /**
   * Give agent a higher-than-normal offset so that it will always render on top
   * of the player when on the same cell.
   * @override
   */
  getSortOrderOffset() {
    return super.getSortOrderOffset() - 1;
  }

  // "Events" levels allow the player to move around with the arrow keys, and
  // perform actions with the space bar.
  updateMovement() {
    if (!this.controller.attemptRunning || !this.controller.getIsDirectPlayerControl()) {
      return;
    }
    const queueIsEmpty = this.queue.isFinished() || !this.queue.isStarted();
    const isMoving = this.movementState !== -1;
    const queueHasOne = this.queue.currentCommand && this.queue.getLength() === 0;
    const timeEllapsed = (+new Date() - this.lastMovement);
    const movementAlmostFinished = timeEllapsed > 300;

    if ((queueIsEmpty || (queueHasOne && movementAlmostFinished)) && isMoving) {
      // Arrow key
      if (this.movementState >= 0) {
        let direction = this.movementState;
        let callbackCommand = new CallbackCommand(this, () => { }, () => {
          this.lastMovement = +new Date();
          this.controller.moveDirection(callbackCommand, direction);
        }, this.identifier);
        this.addCommand(callbackCommand);
        // Spacebar
      } else {
        let callbackCommand = new CallbackCommand(this, () => { }, () => {
          this.lastMovement = +new Date();
          this.controller.use(callbackCommand);
        }, this.identifier);
        this.addCommand(callbackCommand);
      }
    }
  }

  doMove(commandQueueItem, movement) {
    let groundType;
    const levelModel = this.controller.levelModel;
    const levelView = this.controller.levelView;
    const wasOnBlock = this.isOnBlock;
    const prevPosition = this.position;

    // Update position.
    levelModel[`move${movement}`](this);

    const jumpOff = wasOnBlock && wasOnBlock !== this.isOnBlock;
    if (this.isOnBlock || jumpOff) {
      groundType = levelModel.actionPlane.getBlockAt(this.position).blockType;
    } else {
      groundType = levelModel.groundPlane.getBlockAt(this.position).blockType;
    }

    levelView[`playMove${movement}Animation`](this, prevPosition, this.facing, jumpOff, this.isOnBlock, groundType, () => {
      levelView.playIdleAnimation(this.position, this.facing, this.isOnBlock, this);

      this.controller.delayPlayerMoveBy(this.moveDelayMin, this.moveDelayMax, () => {
        commandQueueItem.succeeded();
      });
    });

    this.updateHidingTree();
    this.updateHidingBlock(prevPosition);
  }

  doMoveForward(commandQueueItem) {
    this.doMove(commandQueueItem, 'Forward');
  }

  doMoveBackward(commandQueueItem) {
    this.doMove(commandQueueItem, 'Backward');
  }

  bump(commandQueueItem) {
    var levelView = this.controller.levelView,
      levelModel = this.controller.levelModel;
    levelView.playBumpAnimation(this.position, this.facing, false, this);
    let frontEntity = this.controller.levelEntity.getEntityAt(levelModel.getMoveForwardPosition(this));
    if (frontEntity !== null) {
      const isFriendlyEntity = this.controller.levelEntity.isFriendlyEntity(frontEntity.type);
      // push frienly entity 1 block
      if (isFriendlyEntity) {
        const pushDirection = this.facing;
        var moveAwayCommand = new CallbackCommand(this, () => { }, () => { frontEntity.pushBack(moveAwayCommand, pushDirection, 250); }, frontEntity.identifier);
        frontEntity.queue.startPushHighPriorityCommands();
        frontEntity.addCommand(moveAwayCommand);
        frontEntity.queue.endPushHighPriorityCommands();
      }
    }
    this.controller.delayPlayerMoveBy(200, 400, () => {
      commandQueueItem.succeeded();
    });
  }

  takeDamage(callbackCommand) {
    let facingName = this.controller.levelView.getDirectionName(this.facing);
    this.healthPoint--;
    // still alive
    if (this.healthPoint > 0) {
      this.controller.levelView.playScaledSpeed(this.sprite.animations, "hurt" + facingName);
      callbackCommand.succeeded();
      // report failure since player died
    } else {
      this.sprite.animations.stop(null, true);
      this.controller.levelView.playFailureAnimation(this.position, this.facing, this.isOnBlock, () => {
        callbackCommand.failed();
        this.controller.handleEndState(false);
      });
    }
  }

  hasPermissionToWalk(actionBlock) {
        return (actionBlock.isWalkable);
  }

  canTriggerPressurePlates() {
    return true;
  }
};
class Boat extends BaseEntity {
  constructor(controller, type, identifier, x, y, facing) {
    super(controller, type, identifier, x, y, facing);
    this.offset = [-22, -28];
    this.prepareSprite();
    this.sprite.sortOrder = this.controller.levelView.yToIndex(this.position.y);
  }

  getFrameForDirection() {
    switch (this.facing) {
      case FacingDirection.North:
        return 'Boat_05';
      case FacingDirection.South:
        return 'Boat_01';
      case FacingDirection.East:
        return 'Boat_07';
      case FacingDirection.West:
        return 'Boat_03';
    }
  }

  prepareSprite() {
    const actionGroup = this.controller.levelView.actionGroup;
    const frame = this.getFrameForDirection();
    this.sprite = actionGroup.create(0, 0, 'player' + this.controller.player.name, frame);

    // Initialize.
    this.sprite.x = this.offset[0] + 40 * this.position.x;
    this.sprite.y = this.offset[1] + 40 * this.position.y;

    Boat.addBobTween(this.game, this.sprite);
  }

  /**
   * Apply a "bob up and down in the water" animation to the sprite,
   * which runs forever.
   * @param {Phaser.Game} game
   * @param {Phaser.Sprite} sprite
   * @returns {Phaser.Tween}
   */
  static addBobTween(game, sprite) {
    return game.add.tween(sprite).to(
      { y: '3' },
      1000,
      Phaser.Easing.Sinusoidal.InOut,
      true, // autoStart
      0,    // delay
      -1,   // repeat (forever)
      true  // yoyo
    );
  }
};
class Chicken extends BaseEntity {
    constructor(controller, type, identifier, x, y, facing) {
        super(controller, type, identifier, x, y, facing);
        this.offset = [-25, -32];
        this.prepareSprite();
        this.sprite.sortOrder = this.controller.levelView.yToIndex(this.position.y);
    }

    prepareSprite() {
        let getRandomSecondBetween = function (min, max) {
            return (Math.random() * (max - min) + min) * 1000;
        };
        let frameRate = 12, randomPauseMin = 0.2, randomPauseMax = 1;
        let actionGroup = this.controller.levelView.actionGroup;
        var frameList = [];
        var frameName = "chicken";
        this.sprite = actionGroup.create(0, 0, 'chicken', 'chicken0001.png');
        this.sprite.scale.setTo(0.75,0.75);
        let stillFrameName = ['chicken0222.png', 'chicken0111.png', 'chicken0001.png', 'chicken0333.png'];
        let idleDelayFrame = 8;
        // [direction][[idle],[look left],[look right],[look up],[look down],[walk],[attack],[take dmg],[die],[bump],[eat]]
        var frameListPerDirection = [[[259, 275], [225, 227], [224, 226], [285, 287], [276, 281], [291, 302], [303, 313], [314, 326], [327, 332], [460, 467], [240, 249]], // down
        [[148, 164], [114, 116], [113, 115], [174, 176], [165, 170], [180, 191], [192, 202], [203, 215], [216, 221], [452, 459], [129, 138]], // right
        [[37, 53], [3, 5], [12, 14], [63, 65], [54, 59], [69, 80], [81, 91], [92, 104], [105, 110], [444, 451], [18, 27]], // up
        [[370, 386], [336, 338], [335, 337], [396, 398], [387, 392], [402, 413], [414, 424], [425, 437], [438, 443], [468, 475], [351, 360]]]; // left
        for (var i = 0; i < 4; i++) {
            var facingName = this.controller.levelView.getDirectionName(i);

            // idle sequence
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][0][0], frameListPerDirection[i][0][1], ".png", 4);
            for (var j = 0; j < idleDelayFrame; j++) {
                frameList.push(stillFrameName[i]);
            }
            this.sprite.animations.add("idle" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.playRandomIdle(this.facing);
            });
            // look left sequence ( look left -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][0], frameListPerDirection[i][1][1], ".png", 4);
            this.sprite.animations.add("lookLeft" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookLeft" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][1], frameListPerDirection[i][1][0], ".png", 4);
            this.sprite.animations.add("lookLeft" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look right sequence ( look right -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][0], frameListPerDirection[i][2][1], ".png", 4);
            this.sprite.animations.add("lookRight" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookRight" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][1], frameListPerDirection[i][2][0], ".png", 4);
            this.sprite.animations.add("lookRight" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look up sequence ( look up -> pause for random time -> look front -> play random idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][0], frameListPerDirection[i][3][1], ".png", 4);
            this.sprite.animations.add("lookAtCam" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookAtCam" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][1], frameListPerDirection[i][3][0], ".png", 4);
            this.sprite.animations.add("lookAtCam" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look down
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][4][0], frameListPerDirection[i][4][1], ".png", 4);
            this.sprite.animations.add("lookDown" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // walk
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][5][0], frameListPerDirection[i][5][1], ".png", 4);
            this.sprite.animations.add("walk" + facingName, frameList, frameRate, true);
            // attack
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][6][0], frameListPerDirection[i][6][1], ".png", 4);
            this.sprite.animations.add("attack" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // take damage
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][7][0], frameListPerDirection[i][7][1], ".png", 4);
            this.sprite.animations.add("hurt" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // die
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][8][0], frameListPerDirection[i][8][1], ".png", 4);
            this.sprite.animations.add("die" + facingName, frameList, frameRate, false);
            // bump
            frameList = this.controller.levelView.generateReverseFrames(frameName, frameListPerDirection[i][9][0], frameListPerDirection[i][9][1], ".png", 4);
            this.sprite.animations.add("bump" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // eat
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][10][0], frameListPerDirection[i][10][1], ".png", 4);
            this.sprite.animations.add("eat" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "eat" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));
            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][10][1], frameListPerDirection[i][10][0], ".png", 4);
            this.sprite.animations.add("eat" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
        }
        // initialize
        this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
        this.sprite.x = this.offset[0] + 40 * this.position.x;
        this.sprite.y = this.offset[1] + 40 * this.position.y;
    }
};
class Cod extends BaseEntity {
  constructor(controller, type, identifier, x, y, facing) {
    super(controller, type, identifier, x, y, facing);
    this.offset = [0, 10];
    this.prepareSprite();
    this.sprite.sortOrder = this.controller.levelView.yToIndex(this.position.y);
  }

  getFrameForDirection() {
    if (this.controller.levelModel.isUnderwater()) {
      switch (this.facing) {
        case FacingDirection.North:
          return 'Cod00';
        case FacingDirection.South:
          return 'Cod10';
        case FacingDirection.East:
          return 'Cod05';
        case FacingDirection.West:
          return 'Cod15';
      }
    } else {
      switch (this.facing) {
        case FacingDirection.East:
          return 'Cod_Surface00';
        default:
          return 'Cod_Surface06';
      }

    }
  }
  prepareSprite() {
    let frameRate = 12;
    const frame = this.getFrameForDirection();
    const actionGroup = this.controller.levelView.actionGroup;
    this.sprite = actionGroup.create(0, 0, 'cod', frame+'.png');
    let frameBase = this.controller.levelModel.isUnderwater() ? 'Cod' : 'Cod_Surface';
    let frameListPerDirection = [[6, 12], // up
      [0, 5], // right
      [6, 12], // down
      [6, 12]]; // left
    if (this.controller.levelModel.isUnderwater()) {
      frameListPerDirection = [[0, 3], // up
      [5, 8], // right
      [10, 13], // down
      [15, 18]]; // left
    }
    for (var i = 0; i < 4; i++) {
      let facingName = this.controller.levelView.getDirectionName(i);
      let frameList = Phaser.Animation.generateFrameNames(frameBase, frameListPerDirection[i][0], frameListPerDirection[i][1], ".png", 2);
      this.sprite.animations.add("idle"+facingName, frameList, frameRate, false).onComplete.add(() => {
          this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle"+facingName,.5);
      });
    }
    // Initialize
    let facingName = this.controller.levelView.getDirectionName(this.facing);
    this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + facingName,.5);
    this.sprite.x = this.offset[0] + 40 * this.position.x;
    this.sprite.y = this.offset[1] + 40 * this.position.y;
  }

  canMoveThrough() {
    this.controller.levelEntity.destroyEntity(this.identifier);
    return true;
  }

};
class Cow extends BaseEntity {
    constructor(controller, type, identifier, x, y, facing) {
        super(controller, type, identifier, x, y, facing);
        this.offset = [-43, -55];
        this.prepareSprite();
        this.sprite.sortOrder = this.controller.levelView.yToIndex(this.position.y);
    }

    prepareSprite() {
        let getRandomSecondBetween = function (min, max) {
            return (Math.random() * (max - min) + min) * 1000;
        };
        let frameRate = 12, randomPauseMin = 0.2, randomPauseMax = 1;
        let actionGroup = this.controller.levelView.actionGroup;
        var frameList = [];
        var frameName = "Cow";
        this.sprite = actionGroup.create(0, 0, 'cow', 'Cow0001.png');
        let stillFrameName = ['Cow0222.png', 'Cow0111.png', 'Cow0001.png', 'Cow0333.png'];
        let idleDelayFrame = 20;
        // [direction][[idle],[look left],[look right],[look up],[look down],[walk],[attack],[take dmg],[die],[bump],[idle2],[eat]]
        var frameListPerDirection = [[[258, 264], [225, 227], [224, 226], [285, 287], [240, 241], [291, 302], [303, 313], [314, 326], [327, 332], [460, 467], [276, 282], [240, 249]], // down
        [[147, 153], [114, 116], [129, 130], [174, 176], [129, 130], [180, 191], [192, 202], [203, 215], [216, 221], [452, 459], [165, 171], [129, 138]], // right
        [[36, 42], [3, 5], [12, 14], [63, 65], [18, 19], [69, 80], [81, 91], [92, 104], [105, 110], [444, 451], [51, 54], [18, 27]], // up
        [[369, 375], [336, 338], [335, 337], [396, 398], [351, 352], [402, 413], [414, 424], [425, 437], [438, 443], [468, 475], [387, 393], [351, 360]]]; // left
        for (var i = 0; i < 4; i++) {
            var facingName = this.controller.levelView.getDirectionName(i);

            // idle sequence
            frameList = [];
            for (var j = 0; j < idleDelayFrame; j++) {
                frameList.push(stillFrameName[i]);
            }
            this.sprite.animations.add("idle" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle2" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look left sequence ( look left -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][0], frameListPerDirection[i][1][1], ".png", 4);
            this.sprite.animations.add("lookLeft" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookLeft" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));
            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][1], frameListPerDirection[i][1][0], ".png", 4);
            this.sprite.animations.add("lookLeft" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look right sequence ( look right -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][0], frameListPerDirection[i][2][1], ".png", 4);
            this.sprite.animations.add("lookRight" + facingName, frameList, frameRate, false).onComplete.add(() => {
                //this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookRight" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][1], frameListPerDirection[i][2][0], ".png", 4);
            this.sprite.animations.add("lookRight" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look up sequence ( look up -> pause for random time -> look front -> play random idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][0], frameListPerDirection[i][3][1], ".png", 4);
            this.sprite.animations.add("lookAtCam" + facingName, frameList, frameRate, false).onComplete.add(() => {
                //this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookAtCam" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));
            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][1], frameListPerDirection[i][3][0], ".png", 4);
            this.sprite.animations.add("lookAtCam" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look down
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][4][0], frameListPerDirection[i][4][1], ".png", 4);
            this.sprite.animations.add("lookDown" + facingName, frameList, frameRate, false).onComplete.add(() => {
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookDown" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));
            });

            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][4][1], frameListPerDirection[i][4][0], ".png", 4);
            this.sprite.animations.add("lookDown" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // walk
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][5][0], frameListPerDirection[i][5][1], ".png", 4);
            this.sprite.animations.add("walk" + facingName, frameList, frameRate, true);
            // attack
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][6][0], frameListPerDirection[i][6][1], ".png", 4);
            this.sprite.animations.add("attack" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // take damage
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][7][0], frameListPerDirection[i][7][1], ".png", 4);
            this.sprite.animations.add("hurt" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // die
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][8][0], frameListPerDirection[i][8][1], ".png", 4);
            this.sprite.animations.add("die" + facingName, frameList, frameRate, false);
            // bump
            frameList = this.controller.levelView.generateReverseFrames(frameName, frameListPerDirection[i][9][0], frameListPerDirection[i][9][1], ".png", 4);
            this.sprite.animations.add("bump" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // idle2 sequence
            if (i === 2) {
                frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][10][0], frameListPerDirection[i][10][1], ".png", 4);
                this.sprite.animations.add("idle2" + facingName, frameList, frameRate / 2, false).onComplete.add(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle2" + this.controller.levelView.getDirectionName(this.facing) + "_reverse");
                });

                frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][10][1], frameListPerDirection[i][10][0], ".png", 4);
                this.sprite.animations.add("idle2" + facingName + "_reverse", frameList, frameRate / 2, false).onComplete.add(() => {
                    this.playRandomIdle(this.facing);
                });
            } else {
                frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][10][1], frameListPerDirection[i][10][0], ".png", 4);
                this.sprite.animations.add("idle2" + facingName, frameList, frameRate, false).onComplete.add(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle2" + this.controller.levelView.getDirectionName(this.facing) + "_reverse");
                });
                frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][10][0], frameListPerDirection[i][10][1], ".png", 4);
                this.sprite.animations.add("idle2" + facingName + "_reverse", frameList, frameRate, false).onComplete.add(() => {
                    this.playRandomIdle(this.facing);
                });
            }
            // eat
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][11][0], frameListPerDirection[i][11][1], ".png", 4);
            this.sprite.animations.add("eat" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "eat" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));
            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][11][1], frameListPerDirection[i][11][0], ".png", 4);
            this.sprite.animations.add("eat" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });

        }
        // initialize
        this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
        this.sprite.x = this.offset[0] + 40 * this.position.x;
        this.sprite.y = this.offset[1] + 40 * this.position.y;
    }

    playRandomIdle(facing) {
        var facingName,
            rand,
            animationName = "";
        facingName = this.controller.levelView.getDirectionName(facing);
        rand = Math.trunc(Math.random() * 5) + 1;

        switch (rand) {
            case 1:
                animationName += "idle";
                break;
            case 2:
                animationName += "lookLeft";
                break;
            case 3:
                animationName += "lookRight";
                break;
            case 4:
                animationName += "lookAtCam";
                break;
            case 5:
                animationName += "lookDown";
                break;
            default:
        }

        animationName += facingName;
        this.controller.levelView.playScaledSpeed(this.sprite.animations, animationName);
        this.controller.printErrorMsg(this.type + " calls animation : " + animationName + "\n");
    }
};
class Creeper extends BaseEntity {
    constructor(controller, type, identifier, x, y, facing) {
        super(controller, type, identifier, x, y, facing);
        this.offset = [-43, -55];
        this.prepareSprite();
        this.sprite.sortOrder = this.controller.levelView.yToIndex(this.position.y);
    }

    prepareSprite() {
        let getRandomSecondBetween = function (min, max) {
            return (Math.random() * (max - min) + min) * 1000;
        };
        let frameRate = 10, randomPauseMin = 0.2, randomPauseMax = 1;
        let actionGroup = this.controller.levelView.actionGroup;
        var frameList = [];
        var frameName = "ShadowCreeper_2016_";
        this.sprite = actionGroup.create(0, 0, 'creeper', 'ShadowCreeper_2016_000.png');
        // for normal sheep
        // [direction][[idle],[look left],[look right],[look up],[look down],[walk],[attack],[explode],[take dmg],[die],[bump]]
        var frameListPerDirection = [[[128, 128], [128, 131], [134, 137], [140, 143], [146, 149], [152, 163], [164, 167], [164, 178], [179, 184], [185, 191], [272, 279]], // down
        [[64, 64], [64, 67], [70, 73], [76, 89], [82, 85], [88, 99], [100, 103], [100, 114], [115, 120], [121, 127], [264, 271]], // right
        [[0, 0], [0, 3], [6, 10], [12, 16], [18, 21], [24, 35], [36, 39], [36, 50], [51, 56], [57, 63], [256, 263]], // up
        [[192, 192], [192, 195], [198, 201], [204, 207], [210, 213], [216, 227], [228, 231], [228, 242], [243, 248], [249, 255], [280, 287]]]; // left
        for (var i = 0; i < 4; i++) {
            var facingName = this.controller.levelView.getDirectionName(i);

            // idle sequence
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][0][0], frameListPerDirection[i][0][1], ".png", 3);
            for (var j = 0; j < 12; j++) {
                frameList.push(frameList[0]);
            }
            this.sprite.animations.add("idle" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.playRandomIdle(this.facing);
            });
            // look left sequence ( look left -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][0], frameListPerDirection[i][1][1], ".png", 3);
            this.sprite.animations.add("lookLeft" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookLeft" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][1], frameListPerDirection[i][1][0], ".png", 3);
            this.sprite.animations.add("lookLeft" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look right sequence ( look right -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][0], frameListPerDirection[i][2][1], ".png", 3);
            this.sprite.animations.add("lookRight" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookRight" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][1], frameListPerDirection[i][2][0], ".png", 3);
            this.sprite.animations.add("lookRight" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look up sequence ( look up -> pause for random time -> look front -> play random idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][0], frameListPerDirection[i][3][1], ".png", 3);
            this.sprite.animations.add("lookAtCam" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookAtCam" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][1], frameListPerDirection[i][3][0], ".png", 3);
            this.sprite.animations.add("lookAtCam" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look down
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][4][0], frameListPerDirection[i][4][1], ".png", 3);
            this.sprite.animations.add("lookDown" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookDown_2" + this.controller.levelView.getDirectionName(this.facing));
            });

            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][4][1], frameListPerDirection[i][4][0], ".png", 3);
            this.sprite.animations.add("lookDown_2" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // walk
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][5][0], frameListPerDirection[i][5][1], ".png", 3);
            this.sprite.animations.add("walk" + facingName, frameList, frameRate, true);
            // attack
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][6][0], frameListPerDirection[i][6][1], ".png", 3);
            this.sprite.animations.add("attack" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // explode
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][7][0], frameListPerDirection[i][7][1], ".png", 3);
            this.sprite.animations.add("explode" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // take damage
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][8][0], frameListPerDirection[i][8][1], ".png", 3);
            this.sprite.animations.add("hurt" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // die
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][9][0], frameListPerDirection[i][9][1], ".png", 3);
            this.sprite.animations.add("die" + facingName, frameList, frameRate, false);
            // bump
            frameList = this.controller.levelView.generateReverseFrames(frameName, frameListPerDirection[i][10][0], frameListPerDirection[i][10][1], ".png", 3);
            this.sprite.animations.add("bump" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
        }
        // initialize
        this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
        this.sprite.x = this.offset[0] + 40 * this.position.x;
        this.sprite.y = this.offset[1] + 40 * this.position.y;
    }
};
class Dolphin extends BaseEntity {
  constructor(controller, type, identifier, x, y, facing) {
    super(controller, type, identifier, x, y, facing);
    this.offset = this.controller.levelModel.isUnderwater() ? [-8, -8] : [-40, 0];
    this.prepareSprite();
    this.sprite.sortOrder = this.controller.levelView.yToIndex(this.position.y);
  }

  getFrameForDirection() {
    if (this.controller.levelModel.isUnderwater()) {
      switch (this.facing) {
        case FacingDirection.North:
          return 'Dolphin09';
        case FacingDirection.South:
          return 'Dolphin27';
        case FacingDirection.East:
          return 'Dolphin18';
        case FacingDirection.West:
          return 'Dolphin00';
      }
    } else {
      switch (this.facing) {
        case FacingDirection.East:
          return 'Dolphin_Surface15';
        default:
          return 'Dolphin_Surface00';
      }
  }
}
  prepareSprite() {
    let frameRate = 12;
    console.log(this.controller.levelModel.isUnderwater());
    const frame = this.getFrameForDirection();
    const actionGroup = this.controller.levelView.actionGroup;
    this.sprite = actionGroup.create(0, 0, 'dolphin', frame+'.png');
    let frameBase = this.controller.levelModel.isUnderwater() ? 'Dolphin' : 'Dolphin_Surface';
    let frameListPerDirection = [[0, 14], // up
      [15, 29], // right
      [0, 14], // down
      [0, 14]]; // left
    if (this.controller.levelModel.isUnderwater()) {
      frameListPerDirection = [[9, 16], // up
      [18, 25], // right
      [27, 34], // down
      [0, 7]]; // left
    }
    for (var i = 0; i < 4; i++) {
      let facingName = this.controller.levelView.getDirectionName(i);
      let frameList = Phaser.Animation.generateFrameNames(frameBase, frameListPerDirection[i][0], frameListPerDirection[i][1], ".png", 2);
      this.sprite.animations.add("idle"+facingName, frameList, frameRate, false).onComplete.add(() => {
          this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle"+facingName,.5);
      });
    }
    // Initialize
    let facingName = this.controller.levelView.getDirectionName(this.facing);
    this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + facingName,.5);
    this.sprite.x = this.offset[0] + 40 * this.position.x;
    this.sprite.y = this.offset[1] + 40 * this.position.y;
  }

  canMoveThrough() {
    this.controller.levelEntity.destroyEntity(this.identifier);
    return true;
  }

};
class IronGolem extends BaseEntity {
    constructor(controller, type, identifier, x, y, facing) {
        super(controller, type, identifier, x, y, facing);
        this.offset = [-43, -55];
        this.prepareSprite();
        this.sprite.sortOrder = this.controller.levelView.yToIndex(this.position.y);
    }

    prepareSprite() {
        let getRandomSecondBetween = function (min, max) {
            return (Math.random() * (max - min) + min) * 1000;
        };
        let frameRate = 8, randomPauseMin = 0.2, randomPauseMax = 1;
        let actionGroup = this.controller.levelView.actionGroup;
        var frameList = [];
        var frameName = "Iron_Golem_Anims";
        this.sprite = actionGroup.create(0, 0, 'ironGolem', 'Iron_Golem_Anims001.png');
        // [direction][[idle],[look left],[look right],[look up],[look down],[walk],[attack],[take dmg],[die],[bump]]
        var frameListPerDirection = [[[45, 45], [46, 48], [50, 52], [58, 60], [54, 56], [62, 70], [71, 74], [77, 81], [82, 88], [185, 192]], // down
        [[133, 133], [134, 136], [138, 140], [146, 148], [142, 144], [150, 158], [159, 162], [165, 169], [170, 176], [201, 208]], // right
        [[1, 1], [2, 4], [6, 8], [14, 16], [10, 12], [18, 26], [27, 30], [33, 37], [38, 44], [177, 184]], // up
        [[89, 89], [90, 92], [94, 96], [102, 104], [98, 100], [106, 114], [115, 118], [121, 125], [126, 132], [193, 200]]]; // left
        for (var i = 0; i < 4; i++) {
            var facingName = this.controller.levelView.getDirectionName(i);

            // idle sequence
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][0][0], frameListPerDirection[i][0][1], ".png", 3);
            for (var j = 0; j < 12; j++) {
                frameList.push(frameList[0]);
            }
            this.sprite.animations.add("idle" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.playRandomIdle(this.facing);
            });
            // look left sequence ( look left -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][0], frameListPerDirection[i][1][1], ".png", 3);
            this.sprite.animations.add("lookLeft" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookLeft" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][1], frameListPerDirection[i][1][0], ".png", 3);
            this.sprite.animations.add("lookLeft" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look right sequence ( look right -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][0], frameListPerDirection[i][2][1], ".png", 3);
            this.sprite.animations.add("lookRight" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookRight" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][1], frameListPerDirection[i][2][0], ".png", 3);
            this.sprite.animations.add("lookRight" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look up sequence ( look up -> pause for random time -> look front -> play random idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][0], frameListPerDirection[i][3][1], ".png", 3);
            this.sprite.animations.add("lookAtCam" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookAtCam" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][1], frameListPerDirection[i][3][0], ".png", 3);
            this.sprite.animations.add("lookAtCam" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look down
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][4][0], frameListPerDirection[i][4][1], ".png", 3);
            this.sprite.animations.add("lookDown" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookDown_2" + this.controller.levelView.getDirectionName(this.facing));
            });


            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][4][1], frameListPerDirection[i][4][0], ".png", 3);
            this.sprite.animations.add("lookDown_2" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // walk
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][5][0], frameListPerDirection[i][5][1], ".png", 3);
            this.sprite.animations.add("walk" + facingName, frameList, frameRate, true);
            // attack
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][6][0], frameListPerDirection[i][6][1], ".png", 3);
            this.sprite.animations.add("attack" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // take damage
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][7][0], frameListPerDirection[i][7][1], ".png", 3);
            this.sprite.animations.add("hurt" + facingName, frameList, frameRate * 2 / 3, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // die
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][8][0], frameListPerDirection[i][8][1], ".png", 3);
            this.sprite.animations.add("die" + facingName, frameList, frameRate * 2 / 3, false);
            // bump
            frameList = this.controller.levelView.generateReverseFrames(frameName, frameListPerDirection[i][9][0], frameListPerDirection[i][9][1], ".png", 3);
            this.sprite.animations.add("bump" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
        }
        // initialize
        this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
        this.sprite.x = this.offset[0] + 40 * this.position[0];
        this.sprite.y = this.offset[1] + 40 * this.position[1];
    }
};
class Player extends BaseEntity {
  constructor(controller, type, x, y, name, isOnBlock, facing) {
    super(controller, type, 'Player', x, y, facing);
    this.offset = [-18, -32];
    this.name = name;
    this.isOnBlock = isOnBlock;
    this.inventory = {};
    this.movementState = -1;
    this.onTracks = false;
    this.getOffTrack = false;

    if (controller.getIsDirectPlayerControl()) {
      this.moveDelayMin = 0;
      this.moveDelayMax = 0;
    } else {
      this.moveDelayMin = 30;
      this.moveDelayMax = 200;
    }

    if (controller.levelData.ocean) {
      this.offset = [-26, -26];
    }

    if (controller.levelData.boat) {
      this.offset = [-27, -30];
    }
  }

  /**
   * @override
   */
  canPlaceBlockOver(toPlaceBlock, onTopOfBlock) {
    let result = { canPlace: false, plane: '' };
    if (onTopOfBlock.getIsLiquid()) {
      result.canPlace = true;
      result.plane = "groundPlane";
    } else {
      result.canPlace = true;
      result.plane = "actionPlane";
    }
    if (toPlaceBlock.blockType === "cropWheat") {
      result.canPlace = onTopOfBlock.blockType === "farmlandWet";
    }
    return result;
  }

  /**
   * @override
   */
  canPlaceBlock(block) {
    return block.isEmpty;
  }

  /**
   * @override
   */
  shouldUpdateSelectionIndicator() {
    return true;
  }

  /**
   * @override
   */
  setMovePosition(position) {
    super.setMovePosition(position);
    this.collectItems(this.position);
  }

  /**
   * player walkable stuff
   */
  walkableCheck(block) {
    this.isOnBlock = !block.isWalkable;
  }

  // "Events" levels allow the player to move around with the arrow keys, and
  // perform actions with the space bar.
  updateMovement() {
    if (!this.controller.attemptRunning || !this.controller.getIsDirectPlayerControl()) {
      return;
    }

    if (this.onTracks) {
      this.collectItems(this.position);
    }

    if (this.canUpdateMovement()) {
      // Arrow key
      if (this.movementState >= 0) {
        let direction = this.movementState;
        let callbackCommand = new CallbackCommand(this, () => { }, () => {
          this.lastMovement = +new Date();
          this.controller.moveDirection(callbackCommand, direction);
        }, this.identifier);
        this.addCommand(callbackCommand);
        // Spacebar
      } else {
        let callbackCommand = new CallbackCommand(this, () => { }, () => {
          this.lastMovement = +new Date();
          this.controller.use(callbackCommand);
        }, this.identifier);
        this.addCommand(callbackCommand);
      }
    }
  }

  canUpdateMovement() {
    const queueIsEmpty = this.queue.isFinished() || !this.queue.isStarted();
    const isMoving = this.movementState !== -1;
    const queueHasOne = this.queue.currentCommand && this.queue.getLength() === 0;
    const timeEllapsed = (+new Date() - this.lastMovement);
    const movementAlmostFinished = timeEllapsed > 300;
    if (isMoving && timeEllapsed > 800) {
      // Delay of 800 ms so that the first move onto a rail completes the moveDirection command.
      // Without the delay, the moveDirection conflicts with the onRails check and cancels rail riding as soon as it starts.
      this.getOffTrack = true;
    }
    return !this.onTracks && ((queueIsEmpty || (queueHasOne && movementAlmostFinished)) && isMoving);
  }

  doMoveForward(commandQueueItem) {
    var player = this,
      groundType,
      jumpOff,
      levelModel = this.controller.levelModel,
      levelView = this.controller.levelView;
    let wasOnBlock = player.isOnBlock;
    let prevPosition = this.position;
    // update position
    levelModel.moveForward();
    // TODO: check for Lava, Creeper, water => play approp animation & call commandQueueItem.failed()

    jumpOff = wasOnBlock && wasOnBlock !== player.isOnBlock;
    if (player.isOnBlock || jumpOff) {
      groundType = levelModel.actionPlane.getBlockAt(player.position).blockType;
    } else {
      groundType = levelModel.groundPlane.getBlockAt(player.position).blockType;
    }

    levelView.playMoveForwardAnimation(player, prevPosition, player.facing, jumpOff, player.isOnBlock, groundType, () => this.afterMove(commandQueueItem));

    this.updateHidingTree();
    this.updateHidingBlock(prevPosition);
  }

  doMoveBackward(commandQueueItem) {
    var player = this,
      groundType,
      jumpOff,
      levelModel = this.controller.levelModel,
      levelView = this.controller.levelView;
    let wasOnBlock = player.isOnBlock;
    let prevPosition = this.position;
    // update position
    levelModel.moveBackward(this);
    // TODO: check for Lava, Creeper, water => play approp animation & call commandQueueItem.failed()

    jumpOff = wasOnBlock && wasOnBlock !== player.isOnBlock;
    if (player.isOnBlock || jumpOff) {
      groundType = levelModel.actionPlane.getBlockAt(player.position).blockType;
    } else {
      groundType = levelModel.actionPlane.getBlockAt(player.position).blockType;
    }

    levelView.playMoveBackwardAnimation(player, prevPosition, player.facing, jumpOff, player.isOnBlock, groundType, () => this.afterMove(commandQueueItem));

    this.updateHidingTree();
    this.updateHidingBlock(prevPosition);
  }

  afterMove(commandQueueItem) {
    const levelModel = this.controller.levelModel;
    const levelView = this.controller.levelView;
    levelView.playIdleAnimation(this.position, this.facing, this.isOnBlock);

    if (levelModel.isPlayerStandingInWater() && !levelModel.isInBoat()) {
      levelView.playDrownFailureAnimation(this.position, this.facing, this.isOnBlock, () => {
        this.controller.handleEndState(false);
      });
    } else if (levelModel.isPlayerStandingInLava()) {
      levelView.playBurnInLavaAnimation(this.position, this.facing, this.isOnBlock, () => {
        this.controller.handleEndState(false);
      });
    } else {
      Position.getOrthogonalPositions(this.position).forEach(ortho => {
        const block = levelModel.actionPlane.getBlockAt(ortho);
        if (block && block.blockType.endsWith("Chest") && !block.isOpen) {
          block.isOpen = true;
          levelView.playOpenChestAnimation(ortho);
        }
      });
      this.controller.delayPlayerMoveBy(this.moveDelayMin, this.moveDelayMax, () => {
        commandQueueItem.succeeded();
      });
    }
  }

  bump(commandQueueItem) {
    var levelView = this.controller.levelView,
      levelModel = this.controller.levelModel;
    levelView.playBumpAnimation(this.position, this.facing, false);
    let frontEntity = this.controller.levelEntity.getEntityAt(levelModel.getMoveForwardPosition(this));
    if (frontEntity !== null) {
      const isFriendlyEntity = this.controller.levelEntity.isFriendlyEntity(frontEntity.type);
      // push frienly entity 1 block
      if (isFriendlyEntity) {
        const pushDirection = this.facing;
        var moveAwayCommand = new CallbackCommand(this, () => { }, () => { frontEntity.pushBack(moveAwayCommand, pushDirection, 250); }, frontEntity.identifier);
        frontEntity.queue.startPushHighPriorityCommands();
        frontEntity.addCommand(moveAwayCommand);
        frontEntity.queue.endPushHighPriorityCommands();
      }
    }
    this.controller.delayPlayerMoveBy(200, 400, () => {
      commandQueueItem.succeeded();
    });
  }

  collectItems(targetPosition = this.position) {
    // collectible check
    var collectibles = this.controller.levelView.collectibleItems;
    for (var i = 0; i < collectibles.length; i++) {
      const [sprite, offset, blockType, collectibleDistance] = collectibles[i];
      // already collected item
      if (sprite === null) {
        collectibles.splice(i, 1);
      } else {
        let collectiblePosition = this.controller.levelModel.spritePositionToIndex(offset, new Position(sprite.x, sprite.y));
        if (Position.absoluteDistanceSquare(targetPosition, collectiblePosition) < collectibleDistance) {
          this.controller.levelView.playItemAcquireAnimation(this.position, this.facing, sprite, () => { }, blockType);
          collectibles.splice(i, 1);
        }
      }
    }
  }

  takeDamage(callbackCommand) {
    let facingName = this.controller.levelView.getDirectionName(this.facing);
    this.healthPoint--;
    // still alive
    if (this.healthPoint > 0) {
      this.controller.levelView.playScaledSpeed(this.getAnimationManager(), "hurt" + facingName);
      callbackCommand.succeeded();
      // report failure since player died
    } else {
      this.getAnimationManager().stop(null, true);
      this.controller.levelView.playFailureAnimation(this.position, this.facing, this.isOnBlock, () => {
        callbackCommand.failed();
        this.controller.handleEndState(false);
      });
    }
  }

  canTriggerPressurePlates() {
    return true;
  }

};
class Salmon extends BaseEntity {
  constructor(controller, type, identifier, x, y, facing) {
    super(controller, type, identifier, x, y, facing);
    this.offset = [0,0];
    this.prepareSprite();
    this.sprite.sortOrder = this.controller.levelView.yToIndex(this.position.y);
  }

  getFrameForDirection() {
    if (this.controller.levelModel.isUnderwater()) {
      switch (this.facing) {
        case FacingDirection.North:
          return 'Salmon08';
        case FacingDirection.South:
          return 'Salmon24';
        case FacingDirection.East:
          return 'Salmon16';
        case FacingDirection.West:
          return 'Salmon00';
      }

    } else {
      switch (this.facing) {
        case FacingDirection.East:
          return 'Salmon_Surface00';
        default:
          return 'Salmon_Surface13';
      }
    }
  }
  prepareSprite() {
    let frameRate = 12;
    const frame = this.getFrameForDirection();
    const actionGroup = this.controller.levelView.actionGroup;
    this.sprite = actionGroup.create(0, 0, 'salmon', frame+'.png');
    let frameBase = this.controller.levelModel.isUnderwater() ? 'Salmon' : 'Salmon_Surface';
    let frameListPerDirection = [[13, 25], // up
      [0, 12], // right
      [13, 25], // down
      [13, 25]]; // left
    if (this.controller.levelModel.isUnderwater()) {
      frameListPerDirection = [[8, 14], // up
      [16, 22], // right
      [24, 30], // down
      [0, 6]]; // left
    }
    for (var i = 0; i < 4; i++) {
      let facingName = this.controller.levelView.getDirectionName(i);
      let frameList = Phaser.Animation.generateFrameNames(frameBase, frameListPerDirection[i][0], frameListPerDirection[i][1], ".png", 2);
      this.sprite.animations.add("idle"+facingName, frameList, frameRate, false).onComplete.add(() => {
          this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle"+facingName,.5);
      });
    }
    // Initialize
    let facingName = this.controller.levelView.getDirectionName(this.facing);
    this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + facingName,.5);
    this.sprite.x = this.offset[0] + 40 * this.position.x;
    this.sprite.y = this.offset[1] + 40 * this.position.y;
  }

  canMoveThrough() {
    this.controller.levelEntity.destroyEntity(this.identifier);
    return true;
  }

};
class SeaTurtle extends BaseEntity {
  constructor(controller, type, identifier, x, y, facing) {
    super(controller, type, identifier, x, y, facing);
    this.offset = this.controller.levelModel.isUnderwater() ? [-95,-100] : [-95, -90];
    this.prepareSprite();
    this.sprite.sortOrder = this.controller.levelView.yToIndex(this.position.y);
  }

  getFrameForDirection() {
    if (this.controller.levelModel.isUnderwater()) {
      switch (this.facing) {
        case FacingDirection.North:
          return 'Sea_Turtle00';
        case FacingDirection.South:
          return 'Sea_Turtle10';
        case FacingDirection.East:
          return 'Sea_Turtle05';
        case FacingDirection.West:
          return 'Sea_Turtle15';
      }

    } else {
      switch (this.facing) {
        case FacingDirection.East:
          return 'Sea_Turtle_Surface13';
        default:
          return 'Sea_Turtle_Surface00';
      }
    }
  }
  prepareSprite() {
    let frameRate = 12;
    const frame = this.getFrameForDirection();
    const actionGroup = this.controller.levelView.actionGroup;
    this.sprite = actionGroup.create(0, 0, 'seaTurtle', frame+'.png');
    this.sprite.scale.setTo(.75,.75);
    let frameBase = this.controller.levelModel.isUnderwater() ? 'Sea_Turtle' : 'Sea_Turtle_Surface';
    let frameListPerDirection = [[0, 12], // up
      [13, 25], // right
      [0, 12], // down
      [0, 12]]; // left
    if (this.controller.levelModel.isUnderwater()) {
      frameListPerDirection = [[0, 3], // up
      [5, 8], // right
      [10, 13], // down
      [15, 18]]; // left
    }
    for (var i = 0; i < 4; i++) {
      let facingName = this.controller.levelView.getDirectionName(i);
      let frameList = Phaser.Animation.generateFrameNames(frameBase, frameListPerDirection[i][0], frameListPerDirection[i][1], ".png", 2);
      this.sprite.animations.add("idle"+facingName, frameList, frameRate, false).onComplete.add(() => {
          this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle"+facingName,.5);
      });
    }
    // Initialize
    let facingName = this.controller.levelView.getDirectionName(this.facing);
    this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + facingName,.5);
    this.sprite.x = this.offset[0] + 40 * this.position.x;
    this.sprite.y = this.offset[1] + 40 * this.position.y;
  }

  canMoveThrough() {
    this.controller.levelView.createMiniBlock(this.position.x, this.position.y, "turtle", {
      collectibleDistance: 1,
      xOffsetRange: 10,
      yOffsetRange: 10
    });
    this.controller.levelEntity.destroyEntity(this.identifier);
    return true;
  }

};
class Sheep extends BaseEntity {
    constructor(controller, type, identifier, x, y, facing) {
        super(controller, type, identifier, x, y, facing);
        this.offset = [-43, -55];
        if (this.controller.levelView) {
          this.prepareSprite();
          this.sprite.sortOrder = this.controller.levelView.yToIndex(this.position.y);
        }
        this.naked = false;
    }

    use(commandQueueItem, userEntity) {
        var animationName = this.getNakedSuffix() + "lookAtCam" + this.controller.levelView.getDirectionName(this.facing);
        this.controller.levelView.playScaledSpeed(this.sprite.animations, animationName);
        this.queue.startPushHighPriorityCommands();
        this.controller.events.forEach(e => e({ eventType: EventType.WhenUsed, targetType: this.type, eventSenderIdentifier: userEntity.identifier, targetIdentifier: this.identifier }));
        this.queue.endPushHighPriorityCommands();
        commandQueueItem.succeeded();
    }

    getWalkAnimation() {
        return this.getNakedSuffix() + super.getWalkAnimation();
    }

    getIdleAnimation() {
        return this.getNakedSuffix() + super.getIdleAnimation();
    }

    bump(commandQueueItem) {
        var animName = this.getNakedSuffix() + "bump";
        var facingName = this.controller.levelView.getDirectionName(this.facing);
        this.controller.levelView.playScaledSpeed(this.sprite.animations, animName + facingName);
        let forwardPosition = this.controller.levelModel.getMoveForwardPosition(this);
        let forwardEntity = this.controller.levelEntity.getEntityAt(forwardPosition);
        if (forwardEntity !== null) {
            this.queue.startPushHighPriorityCommands();
            this.controller.events.forEach(e => e({ eventType: EventType.WhenTouched, targetType: this.type, targetIdentifier: this.identifier, eventSenderIdentifier: forwardEntity.identifier }));
            this.queue.endPushHighPriorityCommands();
        }
        this.controller.delayPlayerMoveBy(400, 800, () => {
            commandQueueItem.succeeded();
        });
    }

    prepareSprite() {
        let getRandomSecondBetween = function (min, max) {
            return (Math.random() * (max - min) + min) * 1000;
        };
        let frameRate = 10, randomPauseMin = 0.2, randomPauseMax = 1;
        let actionGroup = this.controller.levelView.actionGroup;
        var frameList = [];
        var frameName = "ShadowSheep_2016";
        this.sprite = actionGroup.create(0, 0, 'sheep', 'ShadowSheep_2016001.png');
        let stillFrameName = ['ShadowSheep_2016217.png', 'ShadowSheep_2016109.png', 'ShadowSheep_2016001.png', 'ShadowSheep_2016325.png'];
        let idleDelayFrame = 8;
        // for normal sheep
        // [direction][[idle],[look left],[look right],[look up],[look down],[walk],[attack],[take dmg],[die],[eat],[bump]]
        var frameListPerDirection = [[[252, 261], [220, 222], [228, 231], [276, 279], [270, 275], [282, 293], [294, 305], [306, 317], [318, 323], [234, 243], [880, 887]], // up
        [[144, 153], [112, 114], [120, 123], [168, 171], [162, 167], [174, 185], [186, 197], [198, 209], [210, 215], [126, 135], [872, 879]], // right
        [[36, 45], [3, 6], [12, 15], [60, 63], [54, 59], [66, 77], [78, 89], [90, 101], [102, 108], [18, 26], [864, 871]], // down
        [[360, 369], [328, 330], [336, 339], [384, 387], [378, 383], [390, 401], [402, 413], [414, 425], [426, 431], [342, 351], [888, 895]]]; // left
        for (let i = 0; i < 4; i++) {
            let facingName = this.controller.levelView.getDirectionName(i);
            // idle sequence
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][0][0], frameListPerDirection[i][0][1], ".png", 3);
            // idle delay
            for (let j = 0; j < idleDelayFrame; j++) {
                frameList.push(stillFrameName[i]);
            }
            this.sprite.animations.add("idle" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.playRandomIdle(this.facing);
            });
            // look left sequence ( look left -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][0], frameListPerDirection[i][1][1], ".png", 3);
            this.sprite.animations.add("lookLeft" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {

                    if (this.naked) {
                        this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_lookLeft" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                    } else {
                        this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookLeft" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                    }
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][1], frameListPerDirection[i][1][0], ".png", 3);
            this.sprite.animations.add("lookLeft" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look right sequence ( look right -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][0], frameListPerDirection[i][2][1], ".png", 3);
            this.sprite.animations.add("lookRight" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    if (this.naked) {
                        this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_lookRight" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                    } else {
                        this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookRight" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                    }
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][1], frameListPerDirection[i][2][0], ".png", 3);
            this.sprite.animations.add("lookRight" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look up sequence ( look up -> pause for random time -> look front -> play random idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][0], frameListPerDirection[i][3][1], ".png", 3);
            this.sprite.animations.add("lookAtCam" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    if (this.naked) {
                        this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_lookAtCam" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                    } else {
                        this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookAtCam" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                    }
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][1], frameListPerDirection[i][3][0], ".png", 3);
            this.sprite.animations.add("lookAtCam" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look down
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][4][0], frameListPerDirection[i][4][1], ".png", 3);
            this.sprite.animations.add("lookDown" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // walk
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][5][0], frameListPerDirection[i][5][1], ".png", 3);
            this.sprite.animations.add("walk" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // attack
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][6][0], frameListPerDirection[i][6][1], ".png", 3);
            this.sprite.animations.add("attack" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // take damage
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][7][0], frameListPerDirection[i][7][1], ".png", 3);
            this.sprite.animations.add("hurt" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // die
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][8][0], frameListPerDirection[i][8][1], ".png", 3);
            this.sprite.animations.add("die" + facingName, frameList, frameRate, false);
            // eat
            frameList = this.controller.levelView.generateReverseFrames(frameName, frameListPerDirection[i][9][0], frameListPerDirection[i][9][1], ".png", 3);
            this.sprite.animations.add("eat" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // bump
            frameList = this.controller.levelView.generateReverseFrames(frameName, frameListPerDirection[i][10][0], frameListPerDirection[i][10][1], ".png", 3);
            this.sprite.animations.add("bump" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
        }
        // for naked sheep
        // [direction][[idle],[look left],[look right],[look up],[look down],[walk],[attack],[take dmg],[die],[eat],[bump]]
        frameListPerDirection = [[[684, 693], [652, 654], [660, 663], [708, 711], [702, 707], [714, 725], [726, 737], [738, 749], [750, 755], [666, 675], [912, 919]], // up
        [[576, 585], [544, 546], [552, 555], [600, 603], [594, 599], [606, 617], [618, 629], [630, 641], [642, 647], [558, 567], [904, 911]], // right
        [[468, 477], [436, 438], [444, 447], [492, 495], [486, 491], [498, 509], [510, 521], [522, 533], [534, 539], [450, 459], [896, 903]], // down
        [[792, 801], [760, 762], [768, 771], [816, 819], [810, 815], [822, 833], [834, 845], [846, 857], [858, 863], [774, 783], [920, 927]]]; // left
        stillFrameName = ['ShadowSheep_2016649.png', 'ShadowSheep_2016541.png', 'ShadowSheep_2016433.png', 'ShadowSheep_2016757.png'];
        for (let i = 0; i < 4; i++) {
            let facingName = this.controller.levelView.getDirectionName(i);

            // idle sequence
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][0][0], frameListPerDirection[i][0][1], ".png", 3);
            // idle delay
            for (let j = 0; j < idleDelayFrame; j++) {
                frameList.push(stillFrameName[i]);
            }
            this.sprite.animations.add("naked_idle" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.playRandomIdle(this.facing);
            });
            // look left sequence ( look left -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][0], frameListPerDirection[i][1][1], ".png", 3);
            this.sprite.animations.add("naked_lookLeft" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_lookLeft" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][1], frameListPerDirection[i][1][0], ".png", 3);
            this.sprite.animations.add("naked_lookLeft" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look right sequence ( look right -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][0], frameListPerDirection[i][2][1], ".png", 3);
            this.sprite.animations.add("naked_lookRight" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_lookRight" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][1], frameListPerDirection[i][2][0], ".png", 3);
            this.sprite.animations.add("naked_lookRight" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look up sequence ( look up -> pause for random time -> look front -> play random idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][0], frameListPerDirection[i][3][1], ".png", 3);
            this.sprite.animations.add("naked_lookAtCam" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_lookAtCam" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][1], frameListPerDirection[i][3][0], ".png", 3);
            this.sprite.animations.add("naked_lookAtCam" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look down
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][4][0], frameListPerDirection[i][4][1], ".png", 3);
            this.sprite.animations.add("naked_lookDown" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // walk
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][5][0], frameListPerDirection[i][5][1], ".png", 3);
            this.sprite.animations.add("naked_walk" + facingName, frameList, frameRate, true);
            // attack
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][6][0], frameListPerDirection[i][6][1], ".png", 3);
            this.sprite.animations.add("naked_attack" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // take damage
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][7][0], frameListPerDirection[i][7][1], ".png", 3);
            this.sprite.animations.add("naked_hurt_" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // die
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][8][0], frameListPerDirection[i][8][1], ".png", 3);
            this.sprite.animations.add("naked_die" + facingName, frameList, frameRate, false);
            // eat
            frameList = this.controller.levelView.generateReverseFrames(frameName, frameListPerDirection[i][9][0], frameListPerDirection[i][9][1], ".png", 3);
            this.sprite.animations.add("naked_eat" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.naked = false;
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // bump
            frameList = this.controller.levelView.generateReverseFrames(frameName, frameListPerDirection[i][10][0], frameListPerDirection[i][10][1], ".png", 3);
            this.sprite.animations.add("naked_bump" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_idle" + this.controller.levelView.getDirectionName(this.facing));
            });
        }

        // initialize
        this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
        this.sprite.x = this.offset[0] + 40 * this.position.x;
        this.sprite.y = this.offset[1] + 40 * this.position.y;
    }

    playRandomIdle(facing) {
        var facingName,
            rand,
            animationName = this.getNakedSuffix();
        facingName = this.controller.levelView.getDirectionName(facing);
        rand = Math.trunc(Math.random() * 6) + 1;
        switch (rand) {
            case 1:
                animationName += "idle";
                break;
            case 2:
                animationName += "lookLeft";
                break;
            case 3:
                animationName += "lookRight";
                break;
            case 4:
                animationName += "lookAtCam";
                break;
            case 5:
                animationName += "lookDown";
                break;
            case 6:
                animationName += "eat";
                break;
            default:
        }

        animationName += facingName;
        this.controller.levelView.playScaledSpeed(this.sprite.animations, animationName);
        this.controller.printErrorMsg(this.type + " calls animation : " + animationName + "\n");
    }

    attack(commandQueueItem) {
        let facingName = this.controller.levelView.getDirectionName(this.facing);
        this.controller.levelView.onAnimationEnd(this.controller.levelView.playScaledSpeed(this.sprite.animations, this.getNakedSuffix() + "attack" + facingName), () => {
            let frontEntity = this.controller.levelEntity.getEntityAt(this.controller.levelModel.getMoveForwardPosition(this));
            if (frontEntity !== null) {
                this.controller.levelView.onAnimationEnd(this.controller.levelView.playScaledSpeed(frontEntity.getAnimationManager(), this.getNakedSuffix() + "hurt" + facingName), () => {
                    this.controller.events.forEach(e => e({ eventType: EventType.WhenAttacked, targetType: this.type, eventSenderIdentifier: this.identifier, targetIdentifier: frontEntity.identifier }));
                });
            }
            commandQueueItem.succeeded();
        });
    }


    updateAnimationDirection() {
        let facingName = this.controller.levelView.getDirectionName(this.facing);
        this.controller.levelView.playScaledSpeed(this.sprite.animations, this.getNakedSuffix() + "idle" + facingName);
    }

    drop(commandQueueItem, itemType) {
        if (this.naked) {
          return false;
        }

        if (commandQueueItem) {
          super.drop(commandQueueItem, itemType);
        }

        if (itemType === 'wool') {
          // default behavior for drop ?
          this.naked = true;
          if (this.controller.levelView) {
            let direction = this.controller.levelView.getDirectionName(this.facing);
            this.controller.levelView.playScaledSpeed(this.sprite.animations, "naked_idle" + direction, () => { });
          }
        }
        return true;
    }

    takeDamage(callbackCommand) {
        let levelView = this.controller.levelView;
        let facingName = levelView.getDirectionName(this.facing);
        if (this.healthPoint > 1) {
            levelView.playScaledSpeed(this.sprite.animations, this.getNakedSuffix() + "hurt" + facingName);
            setTimeout(() => {
                this.healthPoint--;
                callbackCommand.succeeded();
            }, 1500);
        } else {
            this.healthPoint--;
            this.sprite.animations.stop(null, true);
            this.controller.levelView.playScaledSpeed(this.sprite.animations, this.getNakedSuffix() + "die" + facingName);
            setTimeout(() => {

                var tween = this.controller.levelView.addResettableTween(this.sprite).to({
                    alpha: 0
                }, 500, Phaser.Easing.Linear.None);

                tween.onComplete.add(() => {

                    this.controller.levelEntity.destroyEntity(this.identifier);
                });
                tween.start();
            }, 1500);
        }
    }

    getNakedSuffix() {
        return this.naked ? "naked_" : "";
    }
};
class Squid extends BaseEntity {
  constructor(controller, type, identifier, x, y, facing) {
    super(controller, type, identifier, x, y, facing);
    this.prepareSprite();
    this.sprite.sortOrder = this.controller.levelView.yToIndex(this.position.y);
  }

  getOffsetForDirection() {
    switch (this.facing) {
      case FacingDirection.North:
        return [0,0];
      case FacingDirection.South:
        return [0,-24];
      case FacingDirection.East:
        return [-32,-8];
      case FacingDirection.West:
        return [-12,-8];
    }
  }

  getFrameForDirection() {
    switch (this.facing) {
      case FacingDirection.North:
        return 'Squid32';
      case FacingDirection.South:
        return 'Squid00';
      case FacingDirection.East:
        return 'Squid48';
      case FacingDirection.West:
        return 'Squid17';
    }
  }
  prepareSprite() {
    this.offset = this.getOffsetForDirection();
    let frameRate = 12;
    const frame = this.getFrameForDirection();
    const actionGroup = this.controller.levelView.actionGroup;
    this.sprite = actionGroup.create(0, 0, 'squid', frame+'.png');
    this.sprite.scale.setTo(0.75,0.75);
    let frameListPerDirection = [[32, 39], // up
      [40, 47], // right
      [0, 7], // down
      [17, 23]]; // left
    for (var i = 0; i < 4; i++) {
      let facingName = this.controller.levelView.getDirectionName(i);
      let frameList = Phaser.Animation.generateFrameNames("Squid", frameListPerDirection[i][0], frameListPerDirection[i][1], ".png", 2);
      this.sprite.animations.add("idle"+facingName, frameList, frameRate, false).onComplete.add(() => {
          this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle"+facingName,.25);
      });
    }
    // Initialize
    let facingName = this.controller.levelView.getDirectionName(this.facing);
    this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + facingName,.25);
    this.sprite.x = this.offset[0] + 40 * this.position.x;
    this.sprite.y = this.offset[1] + 40 * this.position.y;
  }

  canMoveThrough() {
    this.controller.levelEntity.destroyEntity(this.identifier);
    return true;
  }

};
class TropicalFish extends BaseEntity {
  constructor(controller, type, identifier, x, y, facing) {
    super(controller, type, identifier, x, y, facing);
    this.offset = [0, 16];
    this.prepareSprite();
    this.sprite.sortOrder = this.controller.levelView.yToIndex(this.position.y);
  }

  getFrameForDirection() {
    if (this.controller.levelModel.isUnderwater()) {
      switch (this.facing) {
        case FacingDirection.North:
          return 'Tropical_Fish00';
        case FacingDirection.South:
          return 'Tropical_Fish10';
        case FacingDirection.East:
          return 'Tropical_Fish15';
        case FacingDirection.West:
          return 'Tropical_Fish05';
      }

    } else {
      switch (this.facing) {
        case FacingDirection.East:
          return 'Tropical_Fish_Surface00';
        default:
          return 'Tropical_Fish_Surface07';
      }
    }
  }
  prepareSprite() {
    let frameRate = 12;
    const frame = this.getFrameForDirection();
    const actionGroup = this.controller.levelView.actionGroup;
    this.sprite = actionGroup.create(0, 0, 'tropicalFish', frame+'.png');
    let frameBase = this.controller.levelModel.isUnderwater() ? 'Tropical_Fish' : 'Tropical_Fish_Surface';
    let frameListPerDirection = [[7, 13], // up
      [0, 6], // right
      [7, 13], // down
      [7, 13]]; // left
    if (this.controller.levelModel.isUnderwater()) {
      frameListPerDirection = [[0, 3], // up
      [15, 18], // right
      [10, 13], // down
      [5, 8]]; // left
    }
    for (let i = 0; i < 4; i++) {
      let facingName = this.controller.levelView.getDirectionName(i);
      let frameList = Phaser.Animation.generateFrameNames(frameBase, frameListPerDirection[i][0], frameListPerDirection[i][1], ".png", 2);
      this.sprite.animations.add("idle"+facingName, frameList, frameRate, false).onComplete.add(() => {
          this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle"+facingName,.5);
      });
    }
    // Initialize
    let facingName = this.controller.levelView.getDirectionName(this.facing);
    this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + facingName,.5);
    this.sprite.x = this.offset[0] + 40 * this.position.x;
    this.sprite.y = this.offset[1] + 40 * this.position.y;
  }

  canMoveThrough() {
    this.controller.levelEntity.destroyEntity(this.identifier);
    return true;
  }

};
class Zombie extends BaseEntity {
    constructor(controller, type, identifier, x, y, facing) {
        super(controller, type, identifier, x, y, facing);
        this.offset = [-43, -45];
        this.burningSprite = [null, null];
        this.burningSpriteGhost = [null, null];
        this.burningSpriteOffset = [47, 40];
        this.prepareSprite();
    }

    tick() {
        super.tick();
    }

    reset() {
        for (var i = 0; i < 2; i++) {
            if (this.burningSprite[i]) {
                this.burningSprite[i].destroy();
            }
        }
    }

    playMoveForwardAnimation(position, facing, commandQueueItem, groundType) {
        super.playMoveForwardAnimation(position, facing, commandQueueItem, groundType);

        this.burningSprite[0].sortOrder = this.sprite.sortOrder + 1;
        this.burningSprite[1].sortOrder = this.sprite.sortOrder - 1;

        setTimeout(() => {
            // tween for burning animation
            for (var i = 0; i < 2; i++) {
                const tween = this.controller.levelView.addResettableTween(this.burningSprite[i]).to({
                    x: (this.offset[0] + this.burningSpriteOffset[0] + 40 * position[0]), y: (this.offset[1] + this.burningSpriteOffset[1] + 40 * position[1])
                }, 300, Phaser.Easing.Linear.None);
                tween.onComplete.add(() => {
                });

                tween.start();
            }
        }, 50 / this.controller.tweenTimeScale);
        // smooth movement using tween
    }

    setBurn(burn) {
        if (burn) {
            for (let i = 0; i < 2; i++) {
                this.burningSprite[i].alpha = 1;
            }
        } else {
            for (let i = 0; i < 2; i++) {
                this.burningSprite[i].alpha = 0;
            }
        }
    }

    prepareSprite() {
        let getRandomSecondBetween = function (min, max) {
            return (Math.random() * (max - min) + min) * 1000;
        };
        let frameRate = 10, randomPauseMin = 0.2, randomPauseMax = 1;
        let actionGroup = this.controller.levelView.actionGroup;
        var frameList = [];
        var frameName = "Zombie_";
        this.sprite = actionGroup.create(0, 0, 'zombie', 'Zombie_001.png');
        // update sort order and position
        this.sprite.sortOrder = this.controller.levelView.yToIndex(this.position.y);
        this.sprite.x = this.offset[0] + 40 * this.position.x;
        this.sprite.y = this.offset[1] + 40 * this.position.y;
        // add burning sprite
        this.burningSprite = [actionGroup.create(this.sprite.x + this.burningSpriteOffset[0], this.sprite.y + this.burningSpriteOffset[1], 'burningInSun', "BurningFront_001.png"),
        actionGroup.create(this.sprite.x + this.burningSpriteOffset[0], this.sprite.y + this.burningSpriteOffset[1], 'burningInSun', "BurningBehind_001.png")];

        frameList = Phaser.Animation.generateFrameNames("BurningFront_", 1, 15, ".png", 3);
        this.burningSprite[0].animations.add("burn", frameList, frameRate, true);
        frameList = Phaser.Animation.generateFrameNames("BurningBehind_", 1, 15, ".png", 3);
        this.burningSprite[1].animations.add("burn", frameList, frameRate, true);
        // start burning animation
        this.controller.levelView.playScaledSpeed(this.burningSprite[0].animations, "burn");
        this.controller.levelView.playScaledSpeed(this.burningSprite[1].animations, "burn");
        // update burning sprite's sort order
        this.burningSprite[0].sortOrder = this.sprite.sortOrder + 1;
        this.burningSprite[1].sortOrder = this.sprite.sortOrder - 1;
        var stillFrameName = ['Zombie_056.png', 'Zombie_166.png', 'Zombie_001.png', 'Zombie_111.png'];
        let idleDelayFrame = 8;
        // [direction][[idle],[look left],[look right],[look up],[look down],[walk],[attack],[take dmg],[die],[bump]]
        var frameListPerDirection = [[[73, 79], [57, 59], [61, 63], [69, 71], [65, 67], [80, 88], [89, 91], [93, 101], [102, 110], [229, 236]], // down
        [[183, 189], [167, 169], [171, 173], [179, 181], [175, 177], [190, 198], [199, 201], [203, 211], [212, 220], [245, 252]], // right
        [[18, 24], [2, 4], [6, 8], [14, 16], [10, 12], [25, 33], [34, 36], [38, 46], [47, 55], [221, 228]], // up
        [[128, 134], [112, 114], [116, 118], [124, 126], [120, 122], [135, 143], [144, 146], [148, 156], [158, 165], [237, 244]]]; // left
        for (var i = 0; i < 4; i++) {
            var facingName = this.controller.levelView.getDirectionName(i);

            // idle sequence
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][0][0], frameListPerDirection[i][0][1], ".png", 3);
            for (var j = 0; j < idleDelayFrame; j++) {
                frameList.push(stillFrameName[i]);
            }
            this.sprite.animations.add("idle" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.playRandomIdle(this.facing);
            });
            // look left sequence ( look left -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][0], frameListPerDirection[i][1][1], ".png", 3);
            this.sprite.animations.add("lookLeft" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookLeft" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][1][1], frameListPerDirection[i][1][0], ".png", 3);
            this.sprite.animations.add("lookLeft" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look right sequence ( look right -> pause for random time -> look front -> idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][0], frameListPerDirection[i][2][1], ".png", 3);
            this.sprite.animations.add("lookRight" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookRight" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][2][1], frameListPerDirection[i][2][0], ".png", 3);
            this.sprite.animations.add("lookRight" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look up sequence ( look up -> pause for random time -> look front -> play random idle)
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][0], frameListPerDirection[i][3][1], ".png", 3);
            this.sprite.animations.add("lookAtCam" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.sprite.animations.stop();
                setTimeout(() => {
                    this.controller.levelView.playScaledSpeed(this.sprite.animations, "lookAtCam" + this.controller.levelView.getDirectionName(this.facing) + "_2");
                }, getRandomSecondBetween(randomPauseMin, randomPauseMax));

            });
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][3][1], frameListPerDirection[i][3][0], ".png", 3);
            this.sprite.animations.add("lookAtCam" + facingName + "_2", frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // look down
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][4][0], frameListPerDirection[i][4][1], ".png", 3);
            this.sprite.animations.add("lookDown" + facingName, frameList, frameRate / 3, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // walk
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][5][0], frameListPerDirection[i][5][1], ".png", 3);
            this.sprite.animations.add("walk" + facingName, frameList, frameRate, true);
            // attack
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][6][0], frameListPerDirection[i][6][1], ".png", 3);
            this.sprite.animations.add("attack" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // take damage
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][7][0], frameListPerDirection[i][7][1], ".png", 3);
            this.sprite.animations.add("hurt" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
            // die
            frameList = Phaser.Animation.generateFrameNames(frameName, frameListPerDirection[i][8][0], frameListPerDirection[i][8][1], ".png", 3);
            this.sprite.animations.add("die" + facingName, frameList, frameRate, false);
            // bump
            frameList = this.controller.levelView.generateReverseFrames(frameName, frameListPerDirection[i][9][0], frameListPerDirection[i][9][1], ".png", 3);
            this.sprite.animations.add("bump" + facingName, frameList, frameRate, false).onComplete.add(() => {
                this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
            });
        }
        // initialize
        this.controller.levelView.playScaledSpeed(this.sprite.animations, "idle" + this.controller.levelView.getDirectionName(this.facing));
        // set burn
        this.setBurn(this.controller.levelModel.isDaytime);
    }


    takeDamage(callbackCommand) {
        let levelView = this.controller.levelView;
        let facingName = levelView.getDirectionName(this.facing);
        if (this.healthPoint > 1) {
            levelView.playScaledSpeed(this.sprite.animations, "hurt" + facingName);
            setTimeout(() => {
                this.healthPoint--;
                callbackCommand.succeeded();
            }, 1500 / this.controller.tweenTimeScale);
        } else {
            this.healthPoint--;
            this.controller.levelView.playScaledSpeed(this.sprite.animations, "die" + facingName);
            setTimeout(() => {

                var tween = this.controller.levelView.addResettableTween(this.sprite).to({
                    alpha: 0
                }, 500, Phaser.Easing.Linear.None);

                tween.onComplete.add(() => {
                    this.controller.levelEntity.destroyEntity(this.identifier);
                });

                tween.start();
                for (var i = 0; i < 2; i++) {
                    tween = this.controller.levelView.addResettableTween(this.burningSprite[i]).to({
                        alpha: 0
                    }, 500, Phaser.Easing.Linear.None);
                    tween.start();
                }
            }, 1500 / this.controller.tweenTimeScale);
        }
    }
};
class BaseCommand {
  constructor(gameController, highlightCallback, targetEntity, onFinish) {
    this.GameController = gameController;
    this.Game = gameController.game;
    this.HighlightCallback = highlightCallback;
    this.state = CommandState.NOT_STARTED;
    this.target = targetEntity;
    this.onFinish = onFinish;
    this.repeat = false;
  }

  tick() {
  }

  begin() {
    if (this.HighlightCallback) {
      this.HighlightCallback();
    }
    this.state = CommandState.WORKING;
  }

  /**
   * Whether the command has started working.
   * @returns {boolean}
   */
  isStarted() {
    return this.state !== CommandState.NOT_STARTED;
  }

  /**
   * Whether the command has succeeded or failed, and is
   * finished with its work.
   * @returns {boolean}
   */
  isFinished() {
    return this.isSucceeded() || this.isFailed();
  }

  /**
   * Whether the command has finished with its work and reported success.
   * @returns {boolean}
   */
  isSucceeded() {
    return (this.state === CommandState.SUCCESS);
  }

  /**
   * Whether the command has finished with its work and reported failure.
   * @returns {boolean}
   */
  isFailed() {
    return this.state === CommandState.FAILURE;
  }

  succeeded() {
    this.state = CommandState.SUCCESS;
  }

  failed() {
    this.state = CommandState.FAILURE;
  }
};
class CallbackCommand extends BaseCommand {
  constructor(gameController, highlightCallback, actionCallback, targetEntity, onFinish) {
    super(gameController, highlightCallback, targetEntity, onFinish);
    this.actionCallback = actionCallback;
  }

  tick() {
    // do stuff
  }

  begin() {
    super.begin();
    this.actionCallback();
  }
};
class CommandQueue {
  constructor(gameController) {
    this.gameController = gameController;
    this.game = gameController.game;
    this.reset();
    this.repeatCommands = [];
    this.setUnshiftState = false;
    this.highPriorityCommands = [];
  }

  addCommand(command, repeat = false) {
    command.repeat = repeat;
    // if we're handling a while command, add to the while command's queue instead of this queue
    if (this.whileCommandQueue) {
      this.whileCommandQueue.addCommand(command);
    } else {
      if (this.setUnshiftState) {
        this.highPriorityCommands.push(command);
      } else {
        this.commandList_.push(command);
      }
    }
  }

  setWhileCommandInsertState(queue) {
    this.whileCommandQueue = queue;
  }

  begin() {
    this.state = CommandState.WORKING;
  }

  reset() {
    this.state = CommandState.NOT_STARTED;
    this.currentCommand = null;
    this.commandList_ = [];
    this.highPriorityCommands = [];
    if (this.whileCommandQueue) {
      this.whileCommandQueue.reset();
    }
    this.repeatCommands = [];
    this.whileCommandQueue = null;
  }

  startPushHighPriorityCommands() {
    this.setUnshiftState = true;
    // clear existing highPriorityCommands
    this.highPriorityCommands = [];
  }

  endPushHighPriorityCommands() {
    // unshift highPriorityCommands to the command list
    for (var i = this.highPriorityCommands.length - 1; i >= 0; i--) {
      this.commandList_.unshift(this.highPriorityCommands[i]);
    }
    this.setUnshiftState = false;
  }

  tick() {
    if (this.state === CommandState.WORKING) {
      // if there is no command
      if (!this.currentCommand) {
        // if command list is empty
        if (this.commandList_.length === 0) {
          // mark this queue as a success if there is no repeat command
          if (this.repeatCommands.length === 0) {
            this.state = CommandState.SUCCESS;
          }
          // if there are repeat command for this queue, add them
          this.gameController.startPushRepeatCommand();
          for (var i = 0; i < this.repeatCommands.length; i++) {
            if (this.repeatCommands[i][1] > 0) {
              this.repeatCommands[i][0]();
              this.repeatCommands[i][1]--;
            } else if (this.repeatCommands[i][1] === -1) {
              this.repeatCommands[i][0]();
            } else {
              this.repeatCommands.splice(i, 1);
            }
          }
          this.gameController.endPushRepeatCommand();
          return;
        }
        // get new command from the command list
        this.currentCommand = this.commandList_.shift();
      }

      if (!this.currentCommand.isStarted()) {
        this.currentCommand.begin();
      } else {
        this.currentCommand.tick();
      }

      // check if command is done
      if (this.currentCommand.isSucceeded()) {
        if (this.currentCommand.onFinish) {
          this.currentCommand.onFinish();
        }
        this.currentCommand = null;
      } else if (this.currentCommand.isFailed()) {
        this.state = CommandState.FAILURE;
      }
    }
  }


  getLength() {
    return this.commandList_ ? this.commandList_.length : 0;
  }

  /**
   * Whether the command has started working.
   * @returns {boolean}
   */
  isStarted() {
    return this.state !== CommandState.NOT_STARTED;
  }

  /**
   * Whether the command has succeeded or failed, and is
   * finished with its work.
   * @returns {boolean}
   */
  isFinished() {
    return this.isSucceeded() || this.isFailed();
  }

  /**
   * Whether the command has finished with its work and reported success.
   * @returns {boolean}
   */
  isSucceeded() {
    return this.state === CommandState.SUCCESS;
  }

  /**
   * Whether the command has finished with its work and reported failure.
   * @returns {boolean}
   */
  isFailed() {
    return this.state === CommandState.FAILURE;
  }

  addRepeatCommands(codeBlock, iteration) {
    // forever loop cancel existing forever loops
    if (iteration === -1) {
      for (var i = 0; i < this.repeatCommands.length; i++) {
        if (this.repeatCommands[i][1] === -1) {
          this.repeatCommands.splice(i, 1);
          break;
        }
      }
    }
    this.repeatCommands.push([codeBlock, iteration]);
    this.begin();
  }
};
CommandState = Object.freeze({
  NOT_STARTED: 0,
  WORKING: 1,
  SUCCESS: 2,
  FAILURE: 3
});
class DestroyBlockCommand extends BaseCommand {
  constructor(gameController, highlightCallback, targetEntity) {

    super(gameController, highlightCallback, targetEntity);
  }

  tick() {
    // do stuff
  }

  begin() {
    super.begin();
    this.GameController.destroyBlock(this);
  }
};
class IfBlockAheadCommand extends BaseCommand {
  constructor(gameController, highlightCallback, blockType, targetEntity, callback) {
    super(gameController, highlightCallback, targetEntity);

    this.blockType = blockType;
    this.ifCodeCallback = callback;

    this.queue = new CommandQueue(gameController);
  }

  tick() {
    if (this.state === CommandState.WORKING) {
      // tick our command queue
      this.queue.tick();
    }

    if (this.queue.isFailed()) {
      this.state = CommandState.FAILURE;
    }

    if (this.queue.isSucceeded()) {
      this.state = CommandState.SUCCESS;
    }
  }

  begin() {
    super.begin();
    if (this.GameController.DEBUG) {
      console.log("WHILE command: BEGIN");
    }

    // setup the "if" check
    this.handleIfCheck();
  }

  handleIfCheck() {
    if (this.GameController.isPathAhead(this.blockType)) {
      const targetQueue = this.GameController.getEntity(this.target).queue;
      this.queue.reset();
      targetQueue.setWhileCommandInsertState(this.queue);
      this.ifCodeCallback(); // inserts commands via CodeOrgAPI
      targetQueue.setWhileCommandInsertState(null);
      this.queue.begin();
    } else {
      this.state = CommandState.SUCCESS;
    }
  }
};
class MoveBackwardCommand extends BaseCommand {
  constructor(gameController, highlightCallback, targetEntity) {
    super(gameController, highlightCallback, targetEntity);
  }

  tick() {
    // do stuff
  }

  begin() {
    super.begin();
    this.GameController.moveBackward(this);
  }
};
class MoveDirectionCommand extends BaseCommand {
  constructor(gameController, highlightCallback, targetEntity, direction) {
    super(gameController, highlightCallback, targetEntity);
    this.Direciton = direction;
  }

  tick() {
    // do stuff
  }

  begin() {
    super.begin();
    this.GameController.moveDirection(this, this.Direciton);
  }
};
class MoveForwardCommand extends BaseCommand {
  constructor(gameController, highlightCallback, targetEntity, onFinish) {
    super(gameController, highlightCallback, targetEntity, onFinish);
  }

  tick() {
    // do stuff
  }

  begin() {
    super.begin();
    this.GameController.moveForward(this);
  }
};
class PlaceBlockCommand extends BaseCommand {
  constructor(gameController, highlightCallback, blockType, targetEntity) {
    super(gameController, highlightCallback, targetEntity);

    this.BlockType = blockType;
  }

  tick() {
    // do stuff??
  }

  begin() {
    super.begin();
    this.GameController.placeBlock(this, this.BlockType);
  }
};
class PlaceDirectionCommand extends BaseCommand {
  constructor(gameController, highlightCallback, blockType, targetEntity, direction) {
    super(gameController, highlightCallback, targetEntity);

    this.BlockType = blockType;
    this.Direction = direction;
  }

  tick() {
    // do stuff??
  }

  begin() {
    super.begin();
    this.GameController.placeBlockDirection(this, this.BlockType, this.Direction);
  }
};
class PlaceInFrontCommand extends BaseCommand {
  constructor(gameController, highlightCallback, blockType, targetEntity) {
    super(gameController, highlightCallback, targetEntity);

    this.BlockType = blockType;
  }

  tick() {
    // do stuff??
  }

  begin() {
    super.begin();
    this.GameController.placeBlockForward(this, this.BlockType);
  }
};
class RepeatCommand extends BaseCommand {
  constructor(gameController, highlightCallback, actionCallback, iteration, targetEntity) {
    super(gameController, highlightCallback, targetEntity);
    this.actionCallback = actionCallback;
    this.iteration = iteration;
  }

  tick() {
    // do stuff
  }

  begin() {
    super.begin();
    this.succeeded();
    this.addRepeatCommand();
  }

  addRepeatCommand() {
    var entity = this.GameController.levelEntity.entityMap.get(this.target);
    // if target is undefined, push this command to the master queue
    if (entity === undefined) {
      this.GameController.queue.addRepeatCommands(this.actionCallback, this.iteration);
    } else {
      entity.queue.addRepeatCommands(this.actionCallback, this.iteration);
    }
  }
};
class TurnCommand extends BaseCommand {
  constructor(gameController, highlightCallback, direction, targetEntity) {
    super(gameController, highlightCallback, targetEntity);

    this.Direction = direction;
  }

  tick() {
    // do stuff??
  }

  begin() {
    super.begin();
    if (this.GameController.DEBUG) {
      console.log(`TURN command: BEGIN turning ${this.Direction}  `);
    }
    this.GameController.turn(this, this.Direction);
  }
};
class LevelBlock {
  constructor(blockType) {
    this.blockType = blockType;

    // Default values apply to simple, action-plane destroyable blocks
    this.isEntity = false;
    this.isWalkable = false;
    this.isPlacable = false; // whether another block can be placed in this block's spot
    this.isDestroyable = true;
    this.isUsable = true;
    this.isEmpty = false;
    this.isEmissive = false;
    this.isTransparent = false;
    this.isRedstone = false;
    this.isPowered = false;
    this.isConnectedToRedstone = false; // can this block connect to nearby redstone wire
    this.isRedstoneBattery = false;
    this.isOpen = false;
    this.isRail = false;
    this.isSolid = true;
    this.isWeaklyPowerable = true;
    this.isStickable = true;
    this.isActivatedConduit = false;

    if (blockType === "") {
      this.isWalkable = true;
      this.isDestroyable = false;
      this.isEmpty = true;
      this.isPlacable = true;
      this.isUsable = false;
      this.isWeaklyPowerable = false;
    }

    if (this.getIsMiniblock()) {
      this.isEntity = true;
      this.isWalkable = true;
      this.isDestroyable = false;
      this.isPlacable = true;
      this.isUsable = false;
      this.isTransparent = true;
    }

    if (blockType.match('torch')) {
      this.isWalkable = true;
      this.isPlacable = true;
      this.isStickable = false;
    }

    if (blockType.substring(0, 5) === "rails") {
      this.isWeaklyPowerable = blockType === 'railsRedstoneTorch' ? true : false;
      this.isStickable = blockType === 'railsRedstoneTorch' ? false : true;
      this.isEntity = true;
      this.isWalkable = true;
      this.isUsable = true;
      this.isDestroyable = true;
      this.isTransparent = true;
      this.isRail = blockType !== "railsRedstoneTorch";
      this.isConnectedToRedstone = /^rails(RedstoneTorch|Unpowered|Powered)/.test(blockType);
      this.isRedstoneBattery = blockType === "railsRedstoneTorch";
      this.connectionA = undefined;
      this.connectionB = undefined;
    }

    if (blockType === "sheep") {
      this.isEntity = true;
      this.isDestroyable = false;
      this.isUsable = true;
    }

    if (blockType === "invisible") {
      this.isDestroyable = false;
      this.isUsable = false;
      this.isWeaklyPowerable = false;
      this.isEmissive = true;
    }

    if (blockType.startsWith("glass")) {
      this.isSolid = false;
    }

    if (blockType.startsWith("ice")) {
      this.isSolid = false;
    }

    if (blockType === "creeper") {
      this.isEntity = true;
    }

    if (blockType === "bedrock") {
      this.isDestroyable = false;
    }

    if (blockType === "lava") {
      this.isEmissive = true;
      this.isWalkable = true;
      this.isPlacable = true;
    }

    if (blockType === "magmaUnderwater" || blockType === "magmaDeep") {
      this.isEmissive = true;
    }

    if (blockType === "bubbleColumn") {
      this.isSolid = false;
      this.isTransparent = true;
      this.isEntity = true;
    }

    if (blockType === "conduit") {
      this.isSolid = false;
      this.isEntity = true;
    }

    if (blockType === "water") {
      this.isPlacable = true;
    }

    if (blockType === "torch") {
      this.isEmissive = true;
      this.isEntity = true;
      this.isWalkable = true;
      this.isUsable = true;
      this.isDestroyable = false;
      this.isTransparent = true;
    }

    if (blockType === "cropWheat") {
      this.isEntity = true;
      this.isWalkable = true;
      this.isUsable = true;
      this.isDestroyable = false;
      this.isTransparent = true;
    }

    if (blockType === "tnt") {
      this.isUsable = true;
      this.isDestroyable = true;
    }

    if (blockType === "door") {
      this.isWeaklyPowerable = false;
      this.isSolid = false;
      this.isEntity = true;
      this.isWalkable = false;
      this.isUsable = true;
      this.isDestroyable = false;
      this.isTransparent = true;
      this.isStickable = false;
    }

    if (blockType === "doorIron") {
      this.isWeaklyPowerable = false;
      this.isSolid = false;
      this.isEntity = true;
      this.isWalkable = false;
      this.isDestroyable = false;
      this.isTransparent = true;
      this.isConnectedToRedstone = true;
      this.isStickable = false;
    }

    if (blockType.startsWith("redstoneWire")) {
      this.isEntity = true;
      this.isWalkable = true;
      this.isUsable = true;
      this.isDestroyable = true;
      this.isTransparent = true;
      this.isRedstone = true;
      this.isStickable = false;
    }

    if (blockType.startsWith("pressurePlate")) {
      this.isWeaklyPowerable = blockType === 'pressurePlateUp' ? false : true;
      this.isEntity = true;
      this.isWalkable = true;
      this.isDestroyable = false;
      this.isTransparent = true;
      this.isConnectedToRedstone = true;
      this.isRedstoneBattery = blockType === 'pressurePlateUp' ? false : true;
      this.isStickable = false;
    }

    if (blockType === "glowstone") {
      this.isEntity = true;
    }

    if (blockType === "bedFoot" || blockType === "bedHead") {
      this.isEntity = true;
    }

    if (blockType.startsWith("piston")) {
      this.isWeaklyPowerable = false;
      this.isSolid = false;
      this.isDestroyable = false;
      this.isConnectedToRedstone = !blockType.startsWith("pistonArm");
      if (blockType.substring(blockType.length - 2, blockType.length) === "On" ||
        blockType.startsWith("pistonArm") ||
        blockType.substring(blockType.length - 8, blockType.length) === "OnSticky"
      ) {
        this.isEntity = true;
      }
    }

    if (
      blockType.startsWith("flower") ||
      (/coral/i.test(blockType) && !/Block/.test(blockType)) ||
      blockType === 'seaGrass' ||
      blockType === 'kelp' ||
      blockType === 'seaPickles'
    ) {
      this.isWalkable = true;
      this.isEntity = true; // Don't show shadows or AO -- we should rename this option.
    }

    if (blockType === 'seaPickles' || blockType === 'seaLantern' || blockType === 'magmaBlock') {
      this.isEmissive = true;
    }
  }

  /**
   * Does the given block type represent a "flat" block?
   * "flat" blocks are those subset of walkable blocks which are walkable
   * because they are lying right on the ground, as opposed to those blocks like
   * torches which are walkable because they do not occupy very much space.
   *
   * @return {boolean}
   */
  isFlat() {
    return this.isRail ||
        this.isRedstone ||
        this.blockType.startsWith("pressurePlate");
  }

  notValidOnGroundPlane() {
    return this.blockType.startsWith("rails") || this.blockType.startsWith("redstone");
  }

  skipsDestructionOverlay() {
    return this.isRedstone ||
      this.blockType === "torch" ||
      this.blockType === "railsRedstoneTorch";
  }

  shouldRenderOnGroundPlane() {
    return this.isFlat();
  }

  getIsPowerableRail() {
    return this.isRail && this.isConnectedToRedstone;
  }

  /**
   * Helper method specifically for powered rails, which can only be veritical
   * or horizontal.
   *
   * @return {boolean}
   */
  getIsHorizontal() {
    return this.blockType.match('East|West');
  }

  /**
   * Helper method specifically for powered rails, which can only be veritical
   * or horizontal.
   *
   * @return {boolean}
   */
  getIsVertical() {
    return this.blockType.match('North|South');
  }

  getIsStickyPiston() {
    return this.blockType.substring(this.blockType.length - 6, this.blockType.length) === "Sticky";
  }

  canHoldCharge() {
    return this.isSolid;
  }

  /**
   * @see {LevelBlock.isMiniblock}
   * @return {boolean}
   */
  getIsMiniblock() {
    return LevelBlock.isMiniblock(this.blockType);
  }

  /**
   * @see {LevelBlock.isChestBlock}
   * @return {boolean}
   */
  getIsChestblock() {
    return LevelBlock.isChestblock(this.blockType);
  }

  getIsTree() {
    return !!this.blockType.match(/^tree/);
  }

  getIsDoor() {
    return this.blockType.startsWith("door");
  }

  getIsConduit() {
    return this.blockType.startsWith("conduit");
  }

  getIsLiquid() {
    return this.blockType === "water" ||
        this.blockType === "magmaUnderwater" ||
        this.blockType === "lava";
  }

  getCanFall() {
    return this.blockType === "sand" ||
        this.blockType === "gravel";
  }

  /**
   * Can this block be placed in liquid to replace a liquid block? Should
   * generally be true for all "standard" blocks like cobblestone and dirt, and
   * false for all "special" blocks like redstone and torches.
   *
   * @return {boolean}
   */
  getIsPlaceableInLiquid() {
    const notPlaceable =
      this.isRedstone ||
      this.getIsPiston() ||
      this.isRail ||
      this.blockType === 'torch' ||
      this.blockType === 'railsRedstoneTorch' ||
      this.blockType === 'pressurePlateUp';

    return !notPlaceable;
  }

  /**
   * Note that this will be true for blocks representing the unpowered piston,
   * the "base" of the powered piston, AND the extended arm of the powered
   * piston
   *
   * @return {boolean}
   */
  getIsPiston() {
    return this.blockType.startsWith("piston");
  }

  /**
   * @return {boolean}
   */
  getIsPistonArm() {
    return this.blockType.startsWith("pistonArm");
  }

  getIsPushable() {
    return this.blockType !== "" && !this.isDestroyableUponPush();
  }

  isDestroyableUponPush() {
    return this.blockType.startsWith("redstone") || this.blockType.startsWith("door") || this.blockType.startsWith("railsRedstone") || this.blockType.startsWith("pressure");
  }

  needToRefreshRedstone(){
    if (this.isRedstone || this.blockType === '' || (this.isConnectedToRedstone && !this.blockType.startsWith("piston"))) {
      return true;
    } else {
      return false;
    }
  }

  getPistonDirection() {
    if (this.blockType.startsWith("piston")) {
      let direction = this.blockType.substring(6, 7);
      switch (direction) {
        case "D":
          return South;
        case "U":
          return North;
        case "L":
          return West;
        case "R":
          return East;
      }
    }
  }

  getIsEmptyOrEntity() {
    return this.isEmpty || this.isEntity;
  }

  /**
   * Static to determine if a block would fall from Action Plane into Ground Plane.
   * @param {String} blockType
   * @return {boolean}
   */
  static getCanFall(blockType) {
    return new LevelBlock(blockType).getCanFall();
  }

  /**
   * Static to determine if a block is placeable over water at all.
   * @param {String} blockType
   * @return {boolean}
   */
  static getIsPlaceableInLiquid(blockType) {
    return new LevelBlock(blockType).getIsPlaceableInLiquid();
  }

  /**
   * Static passthrough to the isWalkable property for the given blockType.
   * TODO @hamms: remove this method once all calling methods have been updated
   *      to operate on actual LevelBlocks rather than blockType strings
   *
   * @param {String} blockType
   * @return {boolean}
   */
  static isWalkable(blockType) {
    return new LevelBlock(blockType).isWalkable;
  }

  /**
   * Does the given block type represent a miniblock?
   * TODO @hamms: remove this method once all calling methods have been updated
   *      to operate on actual LevelBlocks rather than blockType strings
   *
   * @param {String} blockType
   * @return {boolean}
   */
  static isMiniblock(blockType) {
    return blockType.endsWith("Miniblock");
  }

  /**
   * Does the given block type represent a chest that reveals a miniblock?
   * TODO @hamms: remove this method once all calling methods have been updated
   *      to operate on actual LevelBlocks rather than blockType strings
   *
   * @param {String} blockType
   * @return {boolean}
   */
  static isChestblock(blockType) {
    return blockType.endsWith("Chest");
  }

  /**
   * Static passthrough to the isWalkable property for the given blockType.
   * TODO @hamms: remove this method once all calling methods have been updated
   *      to operate on actual LevelBlocks rather than blockType strings
   *
   * @param {String} blockType
   * @return {boolean}
   */
  static isFlat(blockType) {
    return new LevelBlock(blockType).isFlat();
  }

  static skipsDestructionOverlay(blockType) {
    return new LevelBlock(blockType).skipsDestructionOverlay();
  }

  static notValidOnGroundPlane(blockType) {
    return new LevelBlock(blockType).notValidOnGroundPlane();
  }

  /**
   * For any given block type, get the appropriate mini block frame (as defined
   * in LevelView.miniblocks) if it exists.
   *
   * For miniblock block types, this should be the miniblock itself, so this
   * means simply removing the "Miniblock" identifier, so a "diamondMiniblock"
   * block will produce a "diamond" frame.
   *
   * For regular block types, this should be the miniblock produced when
   * destroying the block type, so a "oreDiamond" block will produce a "diamond"
   * frame
   *
   * @param {String} blockType
   * @return {String} frame identifier
   */
  static getMiniblockFrame(blockType) {
    if (blockType === "railsRedstoneTorch") {
      return "redstoneTorch";
    }

    if (blockType.startsWith("rails")) {
      return "railNormal";
    }

    if (blockType.endsWith("Chest")) {
      return "chest";
    }

    if (blockType.startsWith("glass") || blockType.startsWith("ice")) {
      return undefined;
    }

    // We use the same miniblock for -all- restoneWire
    if (blockType.substring(0,12) === "redstoneWire") {
      return "redstoneDust";
    }

    // Miniblock block types are suffixed with the string "Miniblock"
    if (LevelBlock.isMiniblock(blockType)) {
      return blockType.replace("Miniblock", "");
    }

    // For everything else, simply map the block type to the desired miniblock
    let frame = blockType;

    switch (frame) {
      case "treeAcacia":
      case "treeBirch":
      case "treeJungle":
      case "treeOak":
      case "treeSpruce":
      case "treeSpruceSnowy":
        frame = "log" + frame.substring(4);
        break;
      case "stone":
        frame = "cobblestone";
        break;
      case "oreCoal":
        frame = "coal";
        break;
      case "oreDiamond":
        frame = "diamond";
        break;
      case "oreIron":
        frame = "ingotIron";
        break;
      case "oreLapis":
        frame = "lapisLazuli";
        break;
      case "oreGold":
        frame = "ingotGold";
        break;
      case "oreEmerald":
        frame = "emerald";
        break;
      case "oreRedstone":
        frame = "redstoneDust";
        break;
      case "grass":
        frame = "dirt";
        break;
      case "tnt":
        frame = "gunPowder";
        break;
    }

    return frame;
  }
};
/**
 * Handling non-player entities inside of the level
 */
class LevelEntity {
  constructor(controller) {
    this.controller = controller;
    this.game = controller.game;
    this.entityMap = new Map();
    this.entityDeathCount = new Map();
    this.sprite = null;
    this.id = 0;
  }

  loadData(levelData) {
    if (levelData.entities !== undefined) {
      for (var i = 0; i < levelData.entities.length; i++) {
        let data = levelData.entities[i];
        let entity = this.createEntity(data[0], this.id++, data[1], data[2], data[3], data[4]);
        entity.updateHidingTree();
        entity.updateHidingBlock();
      }
    }
  }

  tick() {
    let updateEntity = function (value) {
      value.tick();
    };
    this.entityMap.forEach(updateEntity);
  }

  pushEntity(entity) {
    if (!this.entityMap.has(entity.identifier)) {
      this.entityMap.set(entity.identifier, entity);
    } else if (this.controller.DEBUG) {
      this.game.debug.text("Duplicate entity name : " + entity.identifier + "\n");
    }
  }

  isFriendlyEntity(type) {
    const friendlyEntityList = ['sheep', 'ironGolem', 'cow', 'chicken','cod',
    'dolphin','salmon','seaTurtle','seaTurtle',
    'squid','tropicalFish'];
    for (var i = 0; i < friendlyEntityList.length; i++) {
      if (type === friendlyEntityList[i]) {
        return true;
      }
    }
    return false;
  }

  createEntity(type, identifier, x, y, facing, pattern) {
    var entity = null;
    if (!this.entityMap.has(identifier)) {
      switch (type) {
        case 'sheep':
          entity = new Sheep(this.controller, type, identifier, x, y, facing);
          break;
        case 'zombie':
          entity = new Zombie(this.controller, type, identifier, x, y, facing);
          break;
        case 'ironGolem':
          entity = new IronGolem(this.controller, type, identifier, x, y, facing);
          break;
        case 'creeper':
          entity = new Creeper(this.controller, type, identifier, x, y, facing);
          break;
        case 'cow':
          entity = new Cow(this.controller, type, identifier, x, y, facing);
          break;
        case 'chicken':
          entity = new Chicken(this.controller, type, identifier, x, y, facing);
          break;
        case 'cod':
          entity = new Cod(this.controller, type, identifier, x, y, facing);
          break;
        case 'dolphin':
          entity = new Dolphin(this.controller, type, identifier, x, y, facing);
          break;
        case 'ghast':
          entity = new Ghast(this.controller, type, identifier, x, y, facing, pattern);
          break;
        case 'boat':
          entity = new Boat(this.controller, type, identifier, x, y, facing);
          break;
        case 'salmon':
          entity = new Salmon(this.controller, type, identifier, x, y, facing);
          break;
        case 'seaTurtle':
          entity = new SeaTurtle(this.controller, type, identifier, x, y, facing);
          break;
        case 'squid':
          entity = new Squid(this.controller, type, identifier, x, y, facing);
          break;
        case 'tropicalFish':
          entity = new TropicalFish(this.controller, type, identifier, x, y, facing);
          break;
        default:
          entity = new BaseEntity(this.controller, type, identifier, x, y, facing);

      }
      if (this.controller.DEBUG) {
        console.log('Create Entity type : ' + type + ' ' + x + ',' + y);
      }
      this.entityMap.set(identifier, entity);
    } else if (this.controller.DEBUG) {
      this.game.debug.text("Duplicate entity name : " + identifier + "\n");
    }
    return entity;
  }

  isSpawnableInBetween(minX, minY, maxX, maxY) {
    for (var i = minX; i <= maxX; i++) {
      for (var j = minY; j <= maxY; j++) {
        if (this.controller.levelModel.isPositionEmpty(new Position(i, j))[0]) {
          return true;
        }
      }
    }
    return false;
  }

  spawnEntity(type, spawnDirection) {
    let getRandomInt = function (min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };
    let levelModel = this.controller.levelModel;
    let width = levelModel.planeWidth;
    let height = levelModel.planeHeight;
    if (spawnDirection === "middle") {
      if (this.isSpawnableInBetween(Math.floor(0.25 * width), Math.floor(0.25 * height), Math.floor(0.75 * width), Math.floor(0.75 * height))) {
        let position = new Position(
          getRandomInt(Math.floor(0.25 * width), Math.floor(0.75 * width)),
          getRandomInt(Math.floor(0.25 * height), Math.floor(0.75 * height))
        );
        while (!levelModel.isPositionEmpty(position)[0]) {
          position = new Position(
            getRandomInt(Math.floor(0.25 * width), Math.floor(0.75 * width)),
            getRandomInt(Math.floor(0.25 * height), Math.floor(0.75 * height))
          );
        }
        return this.createEntity(type, this.id++, position.x, position.y, getRandomInt(0, 3));
      } else {
        if (!this.isSpawnableInBetween(1, 1, width - 2, height - 2)) {
          return null;
        }
        let position = new Position(
          getRandomInt(1, width - 2),
          getRandomInt(1, height - 2)
        );
        while (!levelModel.isPositionEmpty(position)[0]) {
          position = new Position(
            getRandomInt(1, width - 2),
            getRandomInt(1, height - 2)
          );
        }
        return this.createEntity(type, this.id++, position.x, position.y, getRandomInt(0, 3));
      }
    } else if (spawnDirection === "left") {
      let xIndex = 0;
      let columnFull = true;
      while (xIndex < width && columnFull) {
        columnFull = true;
        for (let i = 0; i < height; i++) {
          if (levelModel.isPositionEmpty(new Position(xIndex, i))[0]) {
            columnFull = false;
            break;
          }
        }
        if (columnFull) {
          xIndex++;
        }
      }
      if (xIndex < width) {
        let position = new Position(xIndex, getRandomInt(0, height - 1));
        while (!levelModel.isPositionEmpty(position)[0]) {
          position = new Position(xIndex, getRandomInt(0, height - 1));
        }
        return this.createEntity(type, this.id++, position.x, position.y, getRandomInt(0, 3));
      }
    } else if (spawnDirection === "right") {
      let xIndex = width - 1;
      let columnFull = true;
      while (xIndex > -1 && columnFull) {
        columnFull = true;
        for (let i = 0; i < height; i++) {
          if (levelModel.isPositionEmpty(new Position(xIndex, i))[0]) {
            columnFull = false;
            break;
          }
        }
        if (columnFull) {
          xIndex--;
        }
      }
      if (xIndex > -1) {
        let position = new Position(xIndex, getRandomInt(0, height - 1));
        while (!levelModel.isPositionEmpty(position)[0]) {
          position = new Position(xIndex, getRandomInt(0, height - 1));
        }
        return this.createEntity(type, this.id++, position.x, position.y, getRandomInt(0, 3));
      }
    } else if (spawnDirection === "up") {
      let yIndex = 0;
      let rowFull = true;
      while (yIndex < height && rowFull) {
        rowFull = true;
        for (let i = 0; i < width; i++) {
          if (levelModel.isPositionEmpty(new Position(i, yIndex))[0]) {
            rowFull = false;
            break;
          }
        }
        if (rowFull) {
          yIndex++;
        }
      }
      if (yIndex < height) {
        let position = new Position(getRandomInt(0, height - 1), yIndex);
        while (!levelModel.isPositionEmpty(position)[0]) {
          position = new Position(getRandomInt(0, height - 1), yIndex);
        }
        return this.createEntity(type, this.id++, position.x, position.y, getRandomInt(0, 3));
      }
    } else if (spawnDirection === "down") {
      let yIndex = height - 1;
      let rowFull = true;
      while (yIndex > -1 && rowFull) {
        rowFull = true;
        for (let i = 0; i < width; i++) {
          if (levelModel.isPositionEmpty(new Position(i, yIndex))[0]) {
            rowFull = false;
            break;
          }
        }
        if (rowFull) {
          yIndex--;
        }
      }
      if (yIndex > -1) {
        let position = new Position(getRandomInt(0, height - 1), yIndex);
        while (!levelModel.isPositionEmpty(position)[0]) {
          position = new Position(getRandomInt(0, height - 1), yIndex);
        }
        return this.createEntity(type, this.id++, position.x, position.y, getRandomInt(0, 3));
      }
    }
    return null;
  }

  spawnEntityAt(type, x, y, facing) {
    return this.createEntity(type, this.id++, x, y, facing);
  }

  destroyEntity(identifier) {
    if (this.entityMap.has(identifier)) {
      var entity = this.entityMap.get(identifier);
      if (this.entityDeathCount.has(entity.type)) {
        this.entityDeathCount.set(entity.type, this.entityDeathCount.get(entity.type) + 1);
      } else {
        this.entityDeathCount.set(entity.type, 1);
      }
      entity.reset();
      entity.getAnimationManager().stop(null, true);
      entity.sprite.destroy();
      this.entityMap.delete(identifier);
    } else if (this.controller.DEBUG) {
      this.game.debug.text("It's impossible to delete since entity name : " + identifier + " is not existing\n");
    }
  }

  getEntityAt(position) {
    for (var value of this.entityMap) {
      let entity = value[1];
      if (Position.equals(position, entity.position)) {
        return entity;
      }
    }
    return null;
  }

  getEntitiesOfType(type) {
    if (type === "all") {
      let entities = [];
      for (let value of this.entityMap) {
        let entity = value[1];
        if (entity.type !== 'Player') {
          entities.push(entity);
        }
      }
      return entities;
    } else {
      let entities = [];
      for (let value of this.entityMap) {
        let entity = value[1];
        if (entity.type === type) {
          entities.push(entity);
        }
      }
      return entities;
    }
  }

  reset() {
    this.entityMap.clear();
    this.entityDeathCount = new Map();
  }
};
// for blocks on the action plane, we need an actual "block" object, so we can model

class LevelModel {
  constructor(levelData, controller) {
    this.planeWidth = levelData.gridDimensions ?
      levelData.gridDimensions[0] : 10;
    this.planeHeight = levelData.gridDimensions ?
      levelData.gridDimensions[1] : 10;
    this.controller = controller;
    this.player = {};
    this.agent = {};
    this.usingAgent = false;

    this.initialLevelData = Object.create(levelData);

    this.reset();

    this.initialPlayerState = Object.create(this.player);
    this.initialAgentState = Object.create(this.agent);
  }

  isUnderwater() {
    return !!this.getOceanType();
  }

  getOceanType() {
    return this.initialLevelData.ocean;
  }

  isInBoat() {
    return this.initialLevelData.boat;
  }

  planeArea() {
    return this.planeWidth * this.planeHeight;
  }

  inBounds(position) {
    const x = position[0];
    const y = position[1];
    return x >= 0 && x < this.planeWidth && y >= 0 && y < this.planeHeight;
  }

  reset() {
    this.groundPlane = new LevelPlane(this.initialLevelData.groundPlane, this.planeWidth, this.planeHeight, this, "groundPlane");
    this.groundDecorationPlane = new LevelPlane(this.initialLevelData.groundDecorationPlane, this.planeWidth, this.planeHeight, this, "decorationPlane");
    this.shadingPlane = [];
    this.actionPlane = new LevelPlane(this.initialLevelData.actionPlane, this.planeWidth, this.planeHeight, this, "actionPlane");

    this.actionPlane.powerRedstone();

    this.actionPlane.getAllPositions().forEach((position) => {
      if (this.actionPlane.getBlockAt(position).isRedstone) {
        this.actionPlane.determineRedstoneSprite(position);
      }
      if (this.actionPlane.getBlockAt(position).isRail) {
        this.actionPlane.determineRailType(position);
      }
    });

    this.fluffPlane = new LevelPlane(this.initialLevelData.fluffPlane, this.planeWidth, this.planeHeight);
    this.fowPlane = [];
    this.isDaytime = this.initialLevelData.isDaytime === undefined || this.initialLevelData.isDaytime;

    let levelData = Object.create(this.initialLevelData);
    if (this.initialLevelData.usePlayer !== undefined) {
      this.usePlayer = this.initialLevelData.usePlayer;
    } else {
      this.usePlayer = true;
    }
    if (this.usePlayer) {
      const position = Position.fromArray(levelData.playerStartPosition);
      this.player = new Player(
        this.controller,
        'Player',
        position.x,
        position.y,
        this.initialLevelData.playerName || 'Steve',
        !this.actionPlane.getBlockAt(position).getIsEmptyOrEntity(),
        levelData.playerStartDirection
      );
      this.controller.levelEntity.pushEntity(this.player);
      this.controller.player = this.player;

      if (levelData.useAgent) {
        this.spawnAgent(levelData);
      }
    }

    // If we have an agent but the level initialization data doesn't define one,
    // then we must have spawned one during the level run and so want to reset
    // back to not having one
    if (!levelData.useAgent && this.usingAgent) {
      this.destroyAgent();
    }

    this.computeShadingPlane();
    this.computeFowPlane();
  }

  /**
   * Creates the Agent entity
   *
   * @param {Object} levelData the initial level data object, specifying the
   *        Agent's default position and direction
   * @param {[Number, Number]} [positionOverride] optional position override
   * @param {Number} [directionOverride] optional direction override
   */
  spawnAgent(levelData, positionOverride, directionOverride) {
    this.usingAgent = true;

    const position = (positionOverride !== undefined)
      ? positionOverride
      : Position.fromArray(levelData.agentStartPosition);

    const direction = (directionOverride !== undefined)
        ? directionOverride
        : levelData.agentStartDirection;

    const name = "PlayerAgent";
    const key = "Agent";

    const startingBlock = this.actionPlane.getBlockAt(position);
    this.agent = new Agent(this.controller, name, position.x, position.y, key, !startingBlock.getIsEmptyOrEntity(), direction);
    this.controller.levelEntity.pushEntity(this.agent);
    this.controller.agent = this.agent;
  }

  /**
   * Destroys the agent entity; is the inverse of spawnAgent.
   */
  destroyAgent() {
    this.controller.agent = undefined;
    this.controller.levelEntity.destroyEntity(this.agent.identifier);
    this.agent = undefined;
    this.usingAgent = false;
  }

  yToIndex(y) {
    return y * this.planeWidth;
  }

  isSolved() {
    return this.initialLevelData.verificationFunction(this);
  }

  isFailed() {
    if (this.initialLevelData.failureCheckFunction !== undefined) {
      return this.initialLevelData.failureCheckFunction(this);
    } else {
      return false;
    }
  }

  getHouseBottomRight() {
    return Position.fromArray(this.initialLevelData.houseBottomRight);
  }

  // Verifications
  isPlayerNextTo(blockType) {
    if (!this.usePlayer) {
      return false;
    }

    return Position.getOrthogonalPositions(this.player.position).some(position => {
      return (
        this.inBounds(position) &&
        (this.isBlockOfType(position, blockType) ||
          this.isEntityOfType(position, blockType) ||
          this.groundPlane.getBlockAt(position).blockType === blockType)
      );
    });
  }

  isEntityNextTo(entityType, blockType) {
    const entityList = this.controller.levelEntity.getEntitiesOfType(entityType);

    return entityList.some(entity => {
      return Position.getOrthogonalPositions(entity.position).some(position => {
        return (
          this.inBounds(position) &&
          (this.isBlockOfType(position, blockType) ||
            this.isEntityOfType(position, blockType) ||
            this.groundPlane.getBlockAt(position).blockType === blockType)
        );
      });
    });
  }

  isEntityOnBlocktype(entityType, blockType, count = 1) {
    var entityList = this.controller.levelEntity.getEntitiesOfType(entityType);
    var resultCount = 0;
    for (var i = 0; i < entityList.length; i++) {
      var entity = entityList[i];
      if (this.isBlockOfType(entity.position, blockType) || this.groundPlane.getBlockAt(entity.position).blockType === blockType) {
        resultCount++;
      }
    }
    return resultCount >= count;
  }

  /**
   * @param {string} entityType
   * @param {Position|Number[]} position to check against as either a Position
   *        instance or an array of the form [x, y]. Array-style position is
   *        supported for compability with the verification API
   */
  isEntityAt(entityType, position) {
    if (Array.isArray(position)) {
      position = Position.fromArray(position);
    }

    var entityList = this.controller.levelEntity.getEntitiesOfType(entityType);
    for (var i = 0; i < entityList.length; i++) {
      var entity = entityList[i];
      if (Position.equals(entity.position, position)) {
        return true;
      }
    }
    return false;
  }

  isEntityTypeRunning(entityType) {
    var entityList = this.controller.levelEntity.getEntitiesOfType(entityType);
    for (var i = 0; i < entityList.length; i++) {
      var entity = entityList[i];
      const notStarted = !entity.queue.isStarted();
      const notFinished = !entity.queue.isFinished();
      if ((notStarted && entity.queue.commandList_.length > 0) || notFinished) {
        return true;
      }
    }
    return false;
  }

  isEntityDied(entityType, count = 1) {
    var deathCount = this.controller.levelEntity.entityDeathCount;
    if (deathCount.has(entityType)) {
      if (deathCount.get(entityType) >= count) {
        return true;
      }
    }
    return false;
  }

  getScore() {
    return this.controller.score;
  }

  shouldRide(direction) {
    let player = this.player;
    let frontPosition = this.getNextRailPosition(player, direction);
    let frontBlock = this.actionPlane.getBlockAt(frontPosition);
    return this.isNextRailValid(frontBlock, direction);
  }

  isNextRailValid(block, direction) {
    if (!block) {
      return;
    }
    return FacingDirection.opposite(block.connectionA) === direction ||
      FacingDirection.opposite(block.connectionB) === direction ||
      block.connectionA === direction ||
      block.connectionB === direction;
  }

  getNextRailPosition(entity = this.player, direction) {
    const offset = Position.directionToOffsetPosition(direction) || new Position(0, 0);
    return Position.add(entity.position, offset);
  }

  getEntityCount(entityType) {
    var entityList = this.controller.levelEntity.getEntitiesOfType(entityType);
    return entityList.length;
  }

  getCommandExecutedCount(commandName, targetType) {
    return this.controller.getCommandCount(commandName, targetType, false);
  }

  getRepeatCommandExecutedCount(commandName, targetType) {
    return this.controller.getCommandCount(commandName, targetType, true);
  }

  getTurnRandomCount() {
    return this.controller.turnRandomCount;
  }

  getInventoryAmount(inventoryType) {
    if (!this.usePlayer) {
      return 0;
    }
    if (inventoryType === "all" || inventoryType === "All") {
      var inventory = this.player.inventory;
      var count = 0;
      for (var key in inventory) {
        count += inventory[key];
      }
      return count;
    }
    return this.player.inventory[inventoryType];
  }

  getInventoryTypes() {
    if (!this.usePlayer) {
      return [];
    }
    return Object.keys(this.player.inventory);
  }

  countOfTypeOnMap(blockType) {
    const blocksOfType = this.actionPlane.getAllPositions().filter((position) => {
      return this.actionPlane.getBlockAt(position).blockType === blockType;
    });

    return blocksOfType.length;
  }

  /**
   * @param {Position|Number[]} position to check against as either a Position
   *        instance or an array of the form [x, y]. Array-style position is
   *        supported for compability with the verification API
   */
  isPlayerAt(position) {
    if (!this.usePlayer) {
      return false;
    }

    if (Array.isArray(position)) {
      position = Position.fromArray(position);
    }
    return Position.equals(this.player.position, position);
  }

  spritePositionToIndex(offset, spritePosition) {
    const position = Position.subtract(spritePosition, offset);
    return new Position(position.x / 40, position.y / 40);
  }

  solutionMapMatchesResultMap(solutionMap) {
    for (var i = 0; i < this.planeArea(); i++) {
      var solutionItemType = solutionMap[i];
      let position = this.actionPlane.indexToCoordinates(i);

      // "" on the solution map means we dont care what's at that spot
      if (solutionItemType !== "") {
        if (solutionItemType === "empty") {
          if (!this.actionPlane.getBlockAt(position).isEmpty) {
            return false;
          }
        } else if (solutionItemType === "any") {
          if (this.actionPlane.getBlockAt(position).isEmpty) {
            return false;
          }
        } else if (this.actionPlane.getBlockAt(position).blockType !== solutionItemType) {
          return false;
        }
      }
    }
    return true;
  }

  getTnt() {
    return this.actionPlane.getAllPositions().filter((position) => {
      const block = this.actionPlane.getBlockAt(position);
      return (block && block.blockType === "tnt");
    });
  }

  getMoveForwardPosition(entity = this.player) {
    return Position.forward(entity.position, entity.facing);
  }

  getMoveDirectionPosition(entity, direction) {
    let absoluteDirection = entity.facing;
    for (let i = 0; i < direction; ++i) {
      absoluteDirection = FacingDirection.turn(absoluteDirection, 'right');
    }
    return Position.forward(entity.position, absoluteDirection);
  }

  isForwardBlockOfType(blockType) {
    let blockForwardPosition = this.getMoveForwardPosition();

    let actionIsEmpty = this.isBlockOfTypeOnPlane(blockForwardPosition, "empty", this.actionPlane);

    if (blockType === '' && actionIsEmpty) {
      return true;
    }

    return actionIsEmpty ?
      this.isBlockOfTypeOnPlane(blockForwardPosition, blockType, this.groundPlane) :
      this.isBlockOfTypeOnPlane(blockForwardPosition, blockType, this.actionPlane);
  }

  getForwardBlockType() {
    const forwardBlock = this.getForwardBlock();
    if (forwardBlock) {
      return forwardBlock.blockType;
    }
    return "";
  }

  getForwardBlock() {
    let blockForwardPosition = this.getMoveForwardPosition();
    return this.actionPlane.getBlockAt(blockForwardPosition);
  }

  isBlockOfType(position, blockType) {
    return this.isBlockOfTypeOnPlane(position, blockType, this.actionPlane);
  }

  isEntityOfType(position, type) {
    const entities = this.controller.levelEntity.getEntitiesOfType(type);
    return entities.some(entity => Position.equals(position, entity.position));
  }

  isBlockOfTypeOnPlane(position, blockType, plane) {
    var result = false;

    if (this.inBounds(position)) {

      if (blockType === "empty") {
        result = plane.getBlockAt(position).isEmpty;
      } else if (blockType === "tree") {
        result = plane.getBlockAt(position).getIsTree();
      } else {
        result = (blockType === plane.getBlockAt(position).blockType);
      }
    }

    return result;
  }

  isPlayerStandingInWater() {
    return this.groundPlane.getBlockAt(this.player.position).blockType === "water";
  }

  isPlayerStandingInLava() {
    return this.groundPlane.getBlockAt(this.player.position).blockType === "lava";
  }

  coordinatesToIndex(coordinates) {
    return this.yToIndex(coordinates[1]) + coordinates[0];
  }

  checkPositionForTypeAndPush(blockType, position, objectArray) {
    if ((!blockType && (this.actionPlane.getBlockAt(position).blockType !== "")) || this.isBlockOfType(position, blockType)) {
      objectArray.push([true, position]);
      return true;
    } else {
      objectArray.push([false, null]);
      return false;
    }
  }

  houseGroundToFloorHelper(position, woolType, arrayCheck) {
    var checkActionBlock,
      posAbove,
      posBelow,
      posRight,
      posLeft,
      checkIndex = 0,
      array = arrayCheck;
    let index = this.yToIndex(position[2]) + position[1];

    if (index === 44) {
      index = 44;
    }

    posAbove = [0, position[1], position[2] + 1];
    posAbove[0] = this.yToIndex(posAbove[2]) + posAbove[1];

    posBelow = [0, position[1], position[2] - 1];
    posBelow[0] = this.yToIndex(posBelow[2]) + posBelow[1];

    posRight = [0, position[1] + 1, position[2]];
    posRight[0] = this.yToIndex(posRight[2]) + posRight[1];

    posLeft = [0, position[1] - 1, position[2]];
    posRight[0] = this.yToIndex(posRight[2]) + posRight[1];

    checkActionBlock = this.actionPlane.getBlockAt(this.actionPlane.indexToCoordinates(index));
    for (var i = 0; i < array.length; ++i) {
      if (array[i][0] === index) {
        checkIndex = -1;
        break;
      }
    }

    if (checkActionBlock.blockType !== "") {
      return {};
    } else if (array.length > 0 && checkIndex === -1) {
      return {};
    }
    array.push(position);
    array.concat(this.houseGroundToFloorHelper(posAbove, woolType, array));
    array.concat(this.houseGroundToFloorHelper(posBelow, woolType, array));
    array.concat(this.houseGroundToFloorHelper(posRight, woolType, array));
    array.concat(this.houseGroundToFloorHelper(posLeft, woolType, array));

    return array;
  }

  houseGroundToFloorBlocks(startingPosition) {
    //checkCardinalDirections for actionblocks.
    //If no action block and square isn't the type we want.
    //Change it.
    var woolType = "wool_orange";

    //Place this block here
    //this.createBlock(this.groundPlane, startingPosition[0], startingPosition[1], woolType);
    var helperStartData = [0, startingPosition[0], startingPosition[1]];
    return this.houseGroundToFloorHelper(helperStartData, woolType, []);
  }

  getEntityAt(position) {
    for (var entity of this.controller.levelEntity.entityMap) {
      if (Position.equals(entity[1].position, position)) {
        return entity[1];
      }
    }
    return undefined;
  }

  getAllBorderingPositionNotOfType(position, blockType) {
    var surroundingBlocks = this.getAllBorderingPosition(position, null);
    for (var b = 1; b < surroundingBlocks.length; ++b) {
      if (surroundingBlocks[b][0] && this.actionPlane.getBlockAt(surroundingBlocks[b][1]).blockType === blockType) {
        surroundingBlocks[b][0] = false;
      }
    }
    return surroundingBlocks;
  }

  getAllBorderingPosition(position, blockType) {
    var allFoundObjects = [false];

    Position.getSurroundingPositions(position).forEach((surroundingPosition) => {
      if (this.checkPositionForTypeAndPush(blockType, surroundingPosition, allFoundObjects)) {
        allFoundObjects[0] = true;
      }
    });

    return allFoundObjects;
  }

  canMoveForward(entity = this.player) {
    const position = this.getMoveForwardPosition(entity);
    if (!this.controller.followingPlayer() && (position.x > 9 || position.y > 9)) {
      return false;
    }
    return this.isPositionEmpty(position, entity);
  }

  canMoveBackward(entity = this.player) {
    const position = this.getMoveDirectionPosition(entity, 2);
    return this.isPositionEmpty(position, entity);
  }

  isPositionEmpty(position, entity = this.player) {
    var result = [false];

    if (this.inBounds(position)) {
      if (!this.actionPlane.getBlockAt(position).isWalkable) {
        result.push("notWalkable");
      }
      if (!this.actionPlane.getBlockAt(position).isEmpty) {
        if (this.player.isOnBlock) {
          return [true];
        }
        result.push("notEmpty");
      }
      // Prevent walking into water/lava in levels where the player is
      // controlled by arrow keys. In levels where the player is controlled by
      // blocks, let them drown.
      const blockTypeAtPosition = this.groundPlane.getBlockAt(position).blockType;
      const frontEntity = this.getEntityAt(position);
      if (['water', 'lava'].includes(blockTypeAtPosition)) {
        if (this.controller.getIsDirectPlayerControl()) {
          result.push(blockTypeAtPosition);
        } else if (frontEntity === undefined || frontEntity.canMoveThrough()) {
          return [true];
        }
      }

      if (this.groundPlane.getBlockAt(position).blockType !== "water" && this.isInBoat()) {
        result.push("notWater");
        return result;
      }

      if (frontEntity !== undefined) {
        result.push("frontEntity");
        result.push(frontEntity);
      }
      let groundBlock = this.groundPlane.getBlockAt(position);
      let actionBlock = this.actionPlane.getBlockAt(position);
      result[0] = entity.hasPermissionToWalk(actionBlock, frontEntity, groundBlock);
    } else {
      result.push("outBound");
    }

    return result;
  }

  canMoveDirection(entity = this.player, direction) {
    // save current direction of the entity
    var currentDirection = entity.facing;
    this.turnToDirection(entity, direction);
    var result = this.canMoveForward(entity);
    // rerotate the entity to the saved direction
    this.turnToDirection(entity, currentDirection);
    return result;
  }

  canPlaceBlock(entity, blockAtPosition) {
    return entity.canPlaceBlock(blockAtPosition);
  }

  canPlaceBlockDirection(blockType = "", entity , direction) {
    if (entity.isOnBlock) {
      return false;
    }
    let plane = this.getPlaneToPlaceOn(this.getMoveDirectionPosition(entity, direction), entity, blockType);
    if (plane === this.groundPlane) {
      if (LevelBlock.notValidOnGroundPlane(blockType) && this.groundPlane.getBlockAt(this.getMoveDirectionPosition(entity, direction))) {
        return false;
      }
    }

    if (this.checkEntityConflict(this.getMoveDirectionPosition(entity, direction))) {
      return false;
    }
    return this.getPlaneToPlaceOn(this.getMoveDirectionPosition(entity, direction), entity, blockType) !== null;
  }

  checkEntityConflict(position) {
    var conflict = false;
    this.controller.levelEntity.entityMap.forEach(entity => {
      if (Position.equals(entity.position, position)) {
        conflict = true;
      }
    });
    return conflict;
  }

  canPlaceBlockForward(blockType = "", entity = this.player) {
    return this.canPlaceBlockDirection(blockType, entity, 0);
  }

  getPlaneToPlaceOn(position, entity, blockType) {
    if (this.inBounds(position)) {
      let actionBlock = this.actionPlane.getBlockAt(position);
      if (entity === this.agent && actionBlock.isEmpty) {
        let groundBlock = this.groundPlane.getBlockAt(position);
        if (groundBlock.getIsLiquid()) {
          if (LevelBlock.getCanFall(blockType)) {
            return this.groundPlane;
          } else if (!LevelBlock.getIsPlaceableInLiquid(blockType)) {
            return null;
          }
        }
        return this.actionPlane;
      }
      if (actionBlock.isPlacable) {
        let groundBlock = this.groundPlane.getBlockAt(position);
        if (groundBlock.isPlacable) {
          return this.groundPlane;
        }
        return this.actionPlane;
      }
    }

    return null;
  }

  canDestroyBlockForward(entity = this.player) {
    var result = false;

    if (!entity.isOnBlock) {
      let blockForwardPosition = this.getMoveForwardPosition(entity);

      if (this.inBounds(blockForwardPosition)) {
        let block = this.actionPlane.getBlockAt(blockForwardPosition);
        result = !block.isEmpty && (block.isDestroyable || block.isUsable);
      }
    }

    return result;
  }

  moveForward(entity = this.player) {
    let blockForwardPosition = this.getMoveForwardPosition(entity);
    this.moveTo(blockForwardPosition, entity);
  }

  moveBackward(entity = this.player) {
    let blockBackwardPosition = this.getMoveDirectionPosition(entity, 2);
    this.moveTo(blockBackwardPosition, entity);
  }

  moveTo(position, entity = this.player) {
    entity.setMovePosition(position);

    if (this.actionPlane.getBlockAt(position).isEmpty) {
      entity.isOnBlock = false;
    }
  }

  turnLeft(entity = this.player) {
    entity.facing = FacingDirection.turn(entity.facing, 'left');
  }

  turnRight(entity = this.player) {
    entity.facing = FacingDirection.turn(entity.facing, 'right');
  }

  turnToDirection(entity = this.player, direction) {
    entity.facing = direction;
  }

  moveDirection(entity = this.player, direction) {
    this.turnToDirection(entity, direction);
    this.moveForward();
  }

  placeBlock(blockType, entity = this.player) {
    const position = entity.position;
    let placedBlock = null;

    const ground = this.groundPlane.getBlockAt(position);
    const currentBlock = this.actionPlane.getBlockAt(position);
    const block = new LevelBlock(blockType);
    let result = entity.canPlaceBlockOver(block, ground);
    if (result.canPlace && !currentBlock.getIsMiniblock()) {
      switch (result.plane) {
        case "actionPlane":
          placedBlock = this.actionPlane.setBlockAt(position, block);
          entity.walkableCheck(block);
          break;
        case "groundPlane":
          this.groundPlane.setBlockAt(position, block);
          break;
      }
    }

    return placedBlock;
  }

  placeBlockForward(blockType, targetPlane, entity = this.player) {
    return this.placeBlockDirection(blockType, targetPlane, entity, 0);
  }

  placeBlockDirection(blockType, targetPlane, entity, direction) {
    let blockPosition = this.getMoveDirectionPosition(entity, direction);

    //for placing wetland for crops in free play
    if (blockType === "watering") {
      blockType = "farmlandWet";
      targetPlane = this.groundPlane;
    }
    return targetPlane.setBlockAt(blockPosition, new LevelBlock(blockType));
  }

  destroyBlock(position) {
    var block = null;

    if (this.inBounds(position)) {
      block = this.actionPlane.getBlockAt(position);
      if (block !== null) {
        block.position = position;

        if (block.isDestroyable) {
          this.actionPlane.setBlockAt(position, new LevelBlock(""));
        }
      }
    }
    return block;
  }

  destroyBlockForward(entity) {
    var block = null;

    let blockForwardPosition = this.getMoveForwardPosition(entity);

    if (this.inBounds(blockForwardPosition)) {
      block = this.actionPlane.getBlockAt(blockForwardPosition);
      if (block !== null) {

        if (block.isDestroyable) {
          this.actionPlane.setBlockAt(blockForwardPosition, new LevelBlock(""));
        }
      }
    }
    return block;
  }

  solveFOWTypeForMap() {
    var emissives,
      blocksToSolve;

    emissives = this.getAllEmissives();
    blocksToSolve = this.findBlocksAffectedByEmissives(emissives);

    for (var block in blocksToSolve) {
      if (blocksToSolve.hasOwnProperty(block)) {
        this.solveFOWTypeFor(blocksToSolve[block], emissives);
      }
    }
  }

  solveFOWTypeFor(position, emissives) {
    var emissivesTouching,
      topLeftQuad = false,
      botLeftQuad = false,
      leftQuad = false,
      topRightQuad = false,
      botRightQuad = false,
      rightQuad = false,
      topQuad = false,
      botQuad = false,
      angle = 0,
      index = this.coordinatesToIndex(position),
      x,
      y;

    emissivesTouching = this.findEmissivesThatTouch(position, emissives);

    for (var torch in emissivesTouching) {
      var currentTorch = emissivesTouching[torch];
      y = position[1];
      x = position[0];

      angle = Math.atan2(currentTorch[1] - position[1], currentTorch[0] - position[0]);
      //invert
      angle = -angle;
      //Normalize to be between 0 and 2*pi
      if (angle < 0) {
        angle += 2 * Math.PI;
      }
      //convert to degrees for simplicity
      angle *= 360 / (2 * Math.PI);

      //top right
      if (!rightQuad && angle > 32.5 && angle <= 57.5) {
        topRightQuad = true;
        this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_InCorner_TopRight", precedence: 0 });
      }//top left
      if (!leftQuad && angle > 122.5 && angle <= 147.5) {
        topLeftQuad = true;
        this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_InCorner_TopLeft", precedence: 0 });
      }//bot left
      if (!leftQuad && angle > 212.5 && angle <= 237.5) {
        botLeftQuad = true;
        this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_InCorner_BottomLeft", precedence: 0 });
      }//botright
      if (!rightQuad && angle > 302.5 && angle <= 317.5) {
        botRightQuad = true;
        this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_InCorner_BottomRight", precedence: 0 });
      }
      //right
      if (angle >= 327.5 || angle <= 32.5) {
        rightQuad = true;
        this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_Right", precedence: 1 });
      }//bot
      if (angle > 237.5 && angle <= 302.5) {
        botQuad = true;
        this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_Bottom", precedence: 1 });
      }
      //left
      if (angle > 147.5 && angle <= 212.5) {
        leftQuad = true;
        this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_Left", precedence: 1 });
      }
      //top
      if (angle > 57.5 && angle <= 122.5) {
        topQuad = true;
        this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_Top", precedence: 1 });
      }
    }

    if (topLeftQuad && botLeftQuad) {
      this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_Left", precedence: 1 });
    }
    if (topRightQuad && botRightQuad) {
      this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_Right", precedence: 1 });
    }
    if (topLeftQuad && topRightQuad) {
      this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_Top", precedence: 1 });
    }
    if (botRightQuad && botLeftQuad) {
      this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_Bottom", precedence: 1 });
    }

    if (leftQuad && rightQuad || topQuad && botQuad || (rightQuad && botQuad && topLeftQuad) ||
      (botQuad && topRightQuad && topLeftQuad) || (topQuad && botRightQuad && botLeftQuad) ||
      (leftQuad && topRightQuad && botRightQuad) || (leftQuad && botQuad && topRightQuad)) {
      //fully lit
      this.fowPlane[index] = "";
    } else if (topLeftQuad && botRightQuad) {
      this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_TopLeftBottomRight", precedence: 2 });
    } else if (botLeftQuad && topRightQuad) {
      this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_BottomLeftTopRight", precedence: 2 });
    } else if ((botQuad && leftQuad) || (botQuad && topLeftQuad) || (leftQuad && botRightQuad)) {
      // darkend botleft corner
      this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_Bottom_Left", precedence: 2 });
    } else if ((botQuad && rightQuad) || (botQuad && topRightQuad) || (rightQuad && botLeftQuad)) {
      // darkend botRight corner
      this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_Bottom_Right", precedence: 2 });
    } else if ((topQuad && rightQuad) || (topQuad && botRightQuad) || (rightQuad && topLeftQuad)) {
      // darkend topRight corner
      this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_Top_Right", precedence: 2 });
    } else if ((topQuad && leftQuad) || (topQuad && botLeftQuad) || (leftQuad && topRightQuad)) {
      // darkend topLeft corner
      this.pushIfHigherPrecedence(index, { x: x, y: y, type: "FogOfWar_Top_Left", precedence: 2 });
    }
  }

  pushIfHigherPrecedence(index, fowObject) {
    if (fowObject === "") {
      this.fowPlane[index] = "";
      return;
    }
    var existingItem = this.fowPlane[index];
    if (existingItem && existingItem.precedence > fowObject.precedence) {
      return;
    }
    this.fowPlane[index] = fowObject;
  }

  /**
   * @return {Position[]}
   */
  getAllEmissives() {
    var emissives = [];
    for (var y = 0; y < this.planeHeight; ++y) {
      for (var x = 0; x < this.planeWidth; ++x) {
        let position = new Position(x, y);
        if (
          (!this.actionPlane.getBlockAt(position).isEmpty &&
            this.actionPlane.getBlockAt(position).isEmissive) ||
          (this.groundPlane.getBlockAt(position).isEmissive &&
            (this.actionPlane.getBlockAt(position).isEmpty || this.actionPlane.getBlockAt(position).isTransparent)) ||
          (this.actionPlane.getBlockAt(position).isEmpty &&
            this.groundDecorationPlane.getBlockAt(position).isEmissive)
        ) {
          emissives.push(position);
        }
      }
    }
    return emissives;
  }

  /**
   * @param {Position[]}
   */
  findBlocksAffectedByEmissives(emissives) {
    var blocksTouchedByEmissives = {};
    //find emissives that are close enough to light us.
    for (var torch in emissives) {
      var currentTorch = emissives[torch];
      let x = currentTorch.x;
      let y = currentTorch.y;
      for (var yIndex = currentTorch.y - 2; yIndex <= (y + 2); ++yIndex) {
        for (var xIndex = currentTorch.x - 2; xIndex <= (x + 2); ++xIndex) {

          let position = new Position(xIndex, yIndex);

          //Ensure we're looking inside the map
          if (!this.inBounds(position)) {
            continue;
          }

          //Ignore the indexes directly around us.
          //Theyre taken care of on the FOW first pass
          if ((yIndex >= y - 1 && yIndex <= y + 1) && (xIndex >= x - 1 && xIndex <= x + 1)) {
            continue;
          }

          //we want unique copies so we use a map.
          blocksTouchedByEmissives[`${yIndex}_${xIndex}`] = position;
        }
      }
    }

    return blocksTouchedByEmissives;
  }

  findEmissivesThatTouch(position, emissives) {
    var emissivesThatTouch = [];
    let y = position.y;
    let x = position.x;

    //find emissives that are close enough to light us.
    for (var yIndex = y - 2; yIndex <= (y + 2); ++yIndex) {
      for (var xIndex = x - 2; xIndex <= (x + 2); ++xIndex) {

        let touchingPosition = new Position(xIndex, yIndex);

        //Ensure we're looking inside the map
        if (!this.inBounds(touchingPosition)) {
          continue;
        }

        //Ignore the indexes directly around us.
        if ((yIndex >= y - 1 && yIndex <= y + 1) && (xIndex >= x - 1 && xIndex <= x + 1)) {
          continue;
        }

        for (var torch in emissives) {
          if (Position.equals(emissives[torch], touchingPosition)) {
            emissivesThatTouch.push(emissives[torch]);
          }
        }
      }
    }

    return emissivesThatTouch;
  }

  computeFowPlane() {
    var x, y;

    this.fowPlane = [];
    if (!this.isDaytime) {
      // compute the fog of war for light emitting blocks
      for (y = 0; y < this.planeHeight; ++y) {
        for (x = 0; x < this.planeWidth; ++x) {
          this.fowPlane.push({ x: x, y: y, type: "FogOfWar_Center" });
        }
      }

      //second pass for partial lit squares
      this.solveFOWTypeForMap();

      for (y = 0; y < this.planeHeight; ++y) {
        for (x = 0; x < this.planeWidth; ++x) {
          const position = new Position(x, y);
          const groundBlock = this.groundPlane.getBlockAt(position);
          const actionBlock = this.actionPlane.getBlockAt(position);
          const decorationBlock = this.groundDecorationPlane.getBlockAt(position);
          if (groundBlock.isEmissive && (actionBlock.isEmpty || actionBlock.isTransparent) ||
            (!actionBlock.isEmpty && actionBlock.isEmissive) ||
            (actionBlock.isEmpty && decorationBlock.isEmissive)) {
            this.clearFowAround(x, y);
          }
        }
      }

    }
  }

  clearFowAround(x, y) {
    var ox, oy;

    for (oy = -1; oy <= 1; ++oy) {
      for (ox = -1; ox <= 1; ++ox) {
        this.clearFowAt(x + ox, y + oy);
      }
    }
  }

  clearFowAt(x, y) {
    if (x >= 0 && x < this.planeWidth && y >= 0 && y < this.planeHeight) {
      let blockIndex = this.yToIndex(y) + x;
      this.fowPlane[blockIndex] = "";
    }
  }

  clearFow() {
    for (var x = 0; x < this.planeWidth; x++) {
      for (var y = 0; y < this.planeHeight; y++) {
        let blockIndex = this.yToIndex(y) + x;
        this.fowPlane[blockIndex] = "";
      }
    }
  }

  computeShadingPlane() {
    this.shadingPlane = [];
    this.computeShading(this.actionPlane);
    this.computeShading(this.groundPlane);
  }

  occludedBy(block) {
    return block && !block.getIsEmptyOrEntity() && !block.getIsLiquid();
  }

  computeShading(plane) {
    var x,
      y,
      index,
      hasRight;

    for (index = 0; index < this.planeArea(); ++index) {
      x = index % this.planeWidth;
      y = Math.floor(index / this.planeWidth);

      const position = new Position(x, y);

      hasRight = false;

      const block = plane.getBlockAt(position);
      const groundBlock = this.groundPlane.getBlockAt(position);
      if (block.isEmpty || block.isTransparent || block.getIsLiquid()) {
        let atlas = 'AO';
        if (block.blockType === 'lava') {
          atlas = 'LavaGlow';
        } else if (block.blockType === 'water' || block.blockType === 'magmaUnderwater') {
          atlas = 'WaterAO';
        }

        if (block === groundBlock || !groundBlock.getIsLiquid()) {
          // Edge of world AO.
          if (y === 0) {
            this.shadingPlane.push({x, y, atlas, type: 'AOeffect_Bottom'});
          }

          if (y === this.planeHeight - 1) {
            this.shadingPlane.push({x, y, atlas, type: 'AOeffect_Top'});
          }

          if (x === 0) {
            this.shadingPlane.push({x, y, atlas, type: 'AOeffect_Right'});
          }

          if (x === this.planeWidth - 1) {
            this.shadingPlane.push({x, y, atlas, type: 'AOeffect_Left'});
          }
        }

        // Neighbor AO.
        const surrounding = plane.getSurroundingBlocks(position);
        if (x < this.planeWidth - 1 && this.occludedBy(surrounding.east)) {
          // needs a left side AO shadow
          this.shadingPlane.push({ x, y, atlas, type: 'AOeffect_Left' });
        }

        if (x > 0 && this.occludedBy(surrounding.west)) {
          // needs a right side AO shadow
          this.shadingPlane.push({ x, y, atlas, type: 'AOeffect_Right' });

          // Lighting shadows.
          if (!block.getIsLiquid()) {
            this.shadingPlane.push({
              x,
              y,
              atlas: 'blockShadows',
              type: 'Shadow_Parts_Fade_base.png'
            });

            if (y > 0 && x > 0 &&
              plane.getBlockAt(Position.north(Position.west(position))).getIsEmptyOrEntity()) {
              this.shadingPlane.push({
                x,
                y,
                atlas: 'blockShadows',
                type: 'Shadow_Parts_Fade_top.png'
              });
            }
          }

          hasRight = true;
        }

        if (y > 0 && this.occludedBy(surrounding.north)) {
          // needs a bottom side AO shadow
          this.shadingPlane.push({ x, y, atlas, type: 'AOeffect_Bottom' });
        } else if (y > 0) {
          if (x < this.planeWidth - 1 && this.occludedBy(surrounding.northEast) &&
            !this.occludedBy(surrounding.east)) {
            // needs a bottom left side AO shadow
            this.shadingPlane.push({ x, y, atlas, type: 'AOeffect_BottomLeft' });
          }

          if (!hasRight && x > 0 && this.occludedBy(surrounding.northWest)) {
            // needs a bottom right side AO shadow
            this.shadingPlane.push({ x, y, atlas, type: 'AOeffect_BottomRight' });
          }
        }

        if (y < this.planeHeight - 1 && this.occludedBy(surrounding.south)) {
          // needs a top side AO shadow
          this.shadingPlane.push({ x, y, atlas, type: 'AOeffect_Top' });
        } else if (y < this.planeHeight - 1) {
          if (x < this.planeWidth - 1 && this.occludedBy(surrounding.southEast) &&
            !this.occludedBy(surrounding.east)) {
            // needs a bottom left side AO shadow
            this.shadingPlane.push({ x, y, atlas, type: 'AOeffect_TopLeft' });
          }

          if (!hasRight && x > 0 && this.occludedBy(surrounding.southWest)) {
            // needs a bottom right side AO shadow
            this.shadingPlane.push({ x, y, atlas, type: 'AOeffect_TopRight' });
          }
        }
      }
    }
  }
};
const {
  opposite,
  turnDirection,
  turn,
  directionToRelative
} = FacingDirection;

const connectionName = function (connection) {
  switch (connection) {
    case North: return 'North';
    case South: return 'South';
    case East: return 'East';
    case West: return 'West';
    default: return '';
  }
};

const RedstoneCircuitConnections = [
  "", "Vertical", "Vertical", "Vertical",
  "Horizontal", "UpRight", "DownRight", "TRight",
  "Horizontal", "UpLeft", "DownLeft", "TLeft",
  "Horizontal", "TUp", "TDown", "Cross",
];

const RailConnectionPriority = [
  [], [North], [South], [North, South],
  [East], [North, East], [South, East], [South, East],
  [West], [North, West], [South, West], [South, West],
  [East, West], [North, East], [South, East], [North, East],
];

const PoweredRailConnectionPriority = [
  [], [North], [South], [North, South],
  [East], [East, West], [East, West], [East, West],
  [West], [East, West], [East, West], [East, West],
  [East, West], [East, West], [East, West], [East, West],
];

class LevelPlane {
  constructor(planeData, width, height, levelModel, planeType) {
    this._data = [];
    this.width = width;
    this.height = height;
    this.levelModel = levelModel;
    this.planeType = planeType;
    this.playPistonOn = false;
    this.playPistonOff = false;

    for (let index = 0; index < planeData.length; ++index) {
      let block = new LevelBlock(planeData[index]);
      this._data.push(block);
    }

    if (this.isActionPlane()) {
      this.redstoneAdjacencySet = this.createRedstoneAdjacencySet();
    }
  }

  /**
   * Determines whether the position in question is within the bounds of the plane.
   */
  inBounds(position) {
    return (
      position.x >= 0 &&
      position.x < this.width &&
      position.y >= 0 &&
      position.y < this.height
    );
  }

  /**
   * Converts coordinates to a index
   */
  coordinatesToIndex(position) {
    return position.y * this.width + position.x;
  }

  /**
  * Determines the positional coordinates given a specific index.
  */
  indexToCoordinates(index) {
    let y = Math.floor(index / this.width);
    let x = index - (y * this.width);
    return new Position(x, y);
  }

  /**
   * Retrieve all the [x, y] coordinates within this plane
   *
   * @return {[Number, Number][]}
   */
  getAllPositions() {
    return this._data.map((_, i) => {
      return this.indexToCoordinates(i);
    });
  }

  /**
   * Gets the block at the desired position within the plane, optionally with an
   * offset
   *
   * @param {Position} position - [x, y] coordinates of block
   *
   * @return {LevelBlock}
   */
  getBlockAt(position) {
    position = Position.fromArray(position);
    if (this.inBounds(position)) {
      return this._data[this.coordinatesToIndex(position)];
    }
  }

  isActionPlane() {
    return this.planeType === "actionPlane";
  }

  isDecorationPlane() {
    return this.planeType === "decorationPlane";
  }

  isGroundPlane() {
    return this.planeType === "groundPlane";
  }

  /**
   * Changes the block at a desired position to the desired block.
   * Important note: This is the cornerstone of block placing/destroying.
   */
  setBlockAt(position, block) {
    position = Position.fromArray(position);
    if (!this.inBounds(position)) {
      return;
    }
    this._data[this.coordinatesToIndex(position)] = block;

    if (this.isActionPlane()) {

      if (block.isRedstone || block.isRedstoneBattery) {
        this.redstoneAdjacencySet.add(position);
      } else {
        this.redstoneAdjacencySet.remove(position);
      }

      let redstoneToRefresh = [];
      if (block.needToRefreshRedstone()) {
        redstoneToRefresh = this.refreshRedstone();
      }

      this.updateWeakCharge(position, block);

      // if we've just removed a block, clean up any rail connections that were
      // formerly connected to this block
      if (block.isEmpty) {
        [North, South, East, West].forEach((direction) => {
          // if the block in the given cardinal direction is a rail block with a
          // connection to this one, sever that connection
          const offset = Position.directionToOffsetPosition(direction);
          const adjacentBlock = this.getBlockAt(Position.add(position, offset));
          if (adjacentBlock && adjacentBlock.isRail) {
            if (adjacentBlock.connectionA === opposite(direction)) {
              adjacentBlock.connectionA = undefined;
            }
            if (adjacentBlock.connectionB === opposite(direction)) {
              adjacentBlock.connectionB = undefined;
            }
          }
        });
      }
      this.determineRailType(position, true);

      if (this.levelModel && this.levelModel.controller.levelView) {
        const northEast = Position.north(Position.east(position));
        const southWest = Position.south(Position.west(position));
        let positionAndTouching = Position.getOrthogonalPositions(position).concat([position, northEast, southWest]);
        this.levelModel.controller.levelView.refreshActionGroup(positionAndTouching);
        this.levelModel.controller.levelView.refreshActionGroup(redstoneToRefresh);
      }
    } else if (this.isGroundPlane()) {
      this.levelModel.controller.levelView.refreshGroundGroup();
    }

    this.resolveConduitState();

    return block;
  }

  /**
  * Gets the blocks within orthogonal positions around a given position.
  * Important note: This DOES to bounds checking. Will be undefined if OOB.
  */
  getOrthogonalBlocks(position) {
    return {
      north: {block: this.getBlockAt(Position.north(position)), relative: South},
      south: {block: this.getBlockAt(Position.south(position)), relative: North},
      east: {block: this.getBlockAt(Position.east(position)), relative: West},
      west: {block: this.getBlockAt(Position.west(position)), relative: East},
    };
  }

  /**
   * Gets the blocks surrounding a given position.
   * Important note: This DOES to bounds checking. Will be undefined if OOB.
   */
  getSurroundingBlocks(position) {
    return {
      north: this.getBlockAt(Position.north(position)),
      northEast: this.getBlockAt(Position.north(Position.east(position))),
      east: this.getBlockAt(Position.east(position)),
      southEast: this.getBlockAt(Position.south(Position.east(position))),
      south: this.getBlockAt(Position.south(position)),
      southWest: this.getBlockAt(Position.south(Position.west(position))),
      west: this.getBlockAt(Position.west(position)),
      northWest: this.getBlockAt(Position.north(Position.west(position))),
    };
  }

  /**
  * Gets the mask of the orthogonal indices around the given position.
  */
  getOrthogonalMask(position, comparator) {
    const orthogonal = this.getOrthogonalBlocks(position);
    return (
      (comparator(orthogonal.north) << 0) +
      (comparator(orthogonal.south) << 1) +
      (comparator(orthogonal.east) << 2) +
      (comparator(orthogonal.west) << 3)
    );
  }

  getMinecartTrack(position, facing) {
    const block = this.getBlockAt(position);

    if (!block.isRail) {
      return;
    }

    const speed = 300;

    if (block.connectionA === facing || block.connectionB === facing) {
      return ["", Position.forward(position, facing), facing, speed];
    }

    const incomming = opposite(facing);
    if (block.connectionA === incomming && block.connectionB !== undefined) {
      const rotation = turnDirection(facing, block.connectionB);
      const newFacing = turn(facing, rotation);
      return [`turn_${rotation}`, position, newFacing, speed];
    }
    if (block.connectionB === incomming && block.connectionA !== undefined) {
      const rotation = turnDirection(facing, block.connectionA);
      const newFacing = turn(facing, rotation);
      return [`turn_${rotation}`, position, newFacing, speed];
    }
  }

  /**
   * Determine whether or not the blocks at the given positions are powered
   * rails that are connected to each other.
   *
   * @param {Posititon} left
   * @param {Posititon} right
   * @return {boolean}
   */
  getPoweredRailsConnected(left, right) {
    // return early if the positions are not even adjacent
    if (!Position.isAdjacent(left, right)) {
      return false;
    }

    const leftBlock = this.getBlockAt(left);
    const rightBlock = this.getBlockAt(right);

    // to be connected, both blocks must be powerable rails
    if (!(leftBlock.getIsPowerableRail() && rightBlock.getIsPowerableRail())) {
      return false;
    }

    // to be connected, both blocks must be oriented either North/South or
    // East/West
    if (leftBlock.getIsHorizontal() && rightBlock.getIsHorizontal()) {
      return Position.equals(Position.forward(left, East), right) ||
          Position.equals(Position.forward(left, West), right);
    } else if (leftBlock.getIsVertical() && rightBlock.getIsVertical()) {
      return Position.equals(Position.forward(left, North), right) ||
          Position.equals(Position.forward(left, South), right);
    } else {
      return false;
    }
  }

  /**
   * Propagate power to (and orient) all redstone wire in the level
   */
  powerRedstone() {
    // redstone charge propagation
    this.redstoneAdjacencySet.sets.forEach((set) => {
      const somePower = set.some((position) => this.getBlockAt(position).isRedstoneBattery);

      set.forEach((position) => {
        this.getBlockAt(position).isPowered = somePower;
        this.determineRedstoneSprite(position);
      });
    });

    return this.redstoneAdjacencySet.flattenSets();
  }

  createRedstoneAdjacencySet() {
    const redstonePositions = this.getAllPositions().filter((position) => {
      const block = this.getBlockAt(position);
      return block.isRedstone || block.isRedstoneBattery;
    });

    return new AdjacencySet(redstonePositions);
  }

  /**
   * Propagate power to (and orient) all powerable rails in the level.
   */
  powerRails() {
    // find all rails that can be powered
    const powerableRails = this.getAllPositions().filter(position => (
      this.getBlockAt(position).getIsPowerableRail()
    ));

    // update powerable rails once to set their orientations
    powerableRails.forEach((position) => {
      this.determineRailType(position);
    });

    // propagate power
    new AdjacencySet(
      powerableRails,
      this.getPoweredRailsConnected.bind(this)
    ).sets.forEach(set => {
      // each set of connected rails should be entirely powered if any of them
      // is powered
      const somePower = set.some(position => this.getBlockAt(position).isPowered);

      if (somePower) {
        set.forEach(position => {
          this.getBlockAt(position).isPowered = true;
        });
      }
    });

    // update all rails again to set their power state
    powerableRails.forEach((position) => {
      this.determineRailType(position);
    });

    return powerableRails;
  }

  /**
   * Determines which rail object should be placed given the context of surrounding
   * indices.
   */
  determineRailType(position, updateTouching = false) {
    const block = this.getBlockAt(position);

    if (!block || !block.isRail) {
      return;
    }

    let powerState = '';
    let priority = RailConnectionPriority;
    if (block.getIsPowerableRail()) {
      powerState = block.isPowered ? 'Powered' : 'Unpowered';
      priority = PoweredRailConnectionPriority;
    }

    if (block.connectionA === undefined || block.connectionB === undefined) {
      const mask = this.getOrthogonalMask(position, ({block, relative}) => {
        if (!block || !block.isRail) {
          return false;
        }
        const a = block.connectionA === undefined || block.connectionA === relative;
        const b = block.connectionB === undefined || block.connectionB === relative;

        return a || b;
      });


      // Look up what type of connection to create, based on the surrounding tracks.
      [block.connectionA, block.connectionB] = priority[mask];
    }

    const variant = connectionName(block.connectionA) + connectionName(block.connectionB);
    block.blockType = `rails${powerState}${variant}`;

    if (updateTouching) {
      Position.getOrthogonalPositions(position).forEach(orthogonalPosition => {
        this.determineRailType(orthogonalPosition);
      });
    }
  }

  /**
  * Determines which redstoneWire variant should be placed given the context of
  * surrounding indices and Powered state.
  */
  determineRedstoneSprite(position) {
    const block = this.getBlockAt(position);

    if (!block || !block.isRedstone) {
      return;
    }

    const mask = this.getOrthogonalMask(position, ({block}) => {
      return block && (block.isRedstone || block.isConnectedToRedstone);
    });

    const variant = RedstoneCircuitConnections[mask];
    const powerState = block.isPowered ? 'On' : '';
    block.blockType = `redstoneWire${variant}${powerState}`;

    return `redstoneWire${variant}`;
  }

  /**
   * Updates the state and sprites of all redstoneWire on the plane.
   * Important note: This is what kicks off redstone charge propagation and is called
   * on place/destroy/run/load.... wherever updating charge is important.
   */
  refreshRedstone() {
    // power redstone
    const redstonePositions = this.powerRedstone();

    // power all blocks powered by redstone
    this.powerAllBlocks();

    // power rails powered by redstone
    const powerableRails = this.powerRails();
    const posToRefresh = redstonePositions.concat(powerableRails);

    // Once we're done updating redstoneWire states, check to see if doors and pistons should open/close.
    this.getAllPositions().forEach((position) => {
      this.getIronDoors(position);
      this.getPistonState(position);
    });
    this.playPistonSound();
    return posToRefresh;
  }

  playPistonSound() {
    if (!this.levelModel) {
      return;
    }
    if (this.playPistonOn) {
      this.levelModel.controller.audioPlayer.play("pistonOut");
    } else if (this.playPistonOff) {
      this.levelModel.controller.audioPlayer.play("pistonIn");
    }
    this.playPistonOn = false;
    this.playPistonOff = false;
  }

  checkEntityConflict(position) {
    if (!this.levelModel) {
      return;
    }
    let captureReturn = false;
    this.levelModel.controller.levelEntity.entityMap.forEach((workingEntity) => {
      if (this.levelModel.controller.positionEquivalence(position, workingEntity.position)) {
        captureReturn = true;
      }
    });
    return captureReturn;
  }

  /**
  * Evaluates what state Iron Doors on the map should be in.
  */
  getIronDoors(position) {
    position = Position.fromArray(position);
    const block = this.getBlockAt(position);
    const index = this.coordinatesToIndex(position);

    if (block.blockType === "doorIron") {
      block.isPowered = this.powerCheck(position, true);
      if (block.isPowered && !block.isOpen) {
        block.isOpen = true;
        if (this.levelModel) {
          this.levelModel.controller.levelView.animateDoor(index, true);
        }
      } else if (!block.isPowered && block.isOpen) {
        if (this.levelModel) {
          if (!this.checkEntityConflict(position)) {
            block.isOpen = false;
            this.levelModel.controller.levelView.animateDoor(index, false);
          }
        }
      }
    }
  }

  /**
  * Evaluates what state Pistons on the map should be in.
  */
  getPistonState(position) {
    const block = this.getBlockAt(position);

    if (block.getIsPiston() && !block.getIsPistonArm()) {
      block.isPowered = this.powerCheck(position, true);
      if (block.isPowered) {
        this.activatePiston(position);
      } else if (!block.isPowered) {
        this.deactivatePiston(position);
      }
      if (this.levelModel) {
        this.levelModel.controller.updateFowPlane();
        this.levelModel.controller.updateShadingPlane();
      }
    }
  }

  /**
  * Find all iron doors in a level and evaluate if they need to be animated based on state
  */
  findDoorToAnimate(positionInQuestion) {
    this.getAllPositions().forEach((position) => {
      const block = this.getBlockAt(position);
      const index = this.coordinatesToIndex(position);

      if (block.blockType === "doorIron" && position !== positionInQuestion) {
        block.isPowered = this.powerCheck(position, true);
        if (block.isPowered && !block.isOpen) {
          block.isOpen = true;
          if (this.levelModel) {
            this.levelModel.controller.levelView.animateDoor(index, true);
          }
        } else if (!block.isPowered && block.isOpen && !this.checkEntityConflict(position)) {
          block.isOpen = false;
          if (this.levelModel) {
            this.levelModel.controller.levelView.animateDoor(index, false);
          }
        }
      }
    });
  }

  /**
   * Activates a piston at a given position to push blocks away from it
   * depending on type.
   */
  activatePiston(position) {
    const block = this.getBlockAt(position);

    let pistonType = block.blockType;
    if (block.getIsStickyPiston()) {
      pistonType = pistonType.substring(0, pistonType.length - 6);
    }
    let checkOn = pistonType.substring(pistonType.length - 2, pistonType.length);
    if (checkOn === "On") {
      pistonType = pistonType.substring(0, pistonType.length - 2);
    }

    const direction = block.getPistonDirection();
    let armType = `pistonArm${directionToRelative(direction)}`;

    const offset = Position.directionToOffsetPosition(direction);
    const pos = Position.forward(position, direction);
    const workingNeighbor = this.getBlockAt(pos);

    if (this.pistonArmBlocked(position, offset)) {
      return;
    }
    // Break an object right in front of the piston.
    if (workingNeighbor.isDestroyableUponPush()) {
      this.setBlockAt(pos, new LevelBlock(""));
      this.playPistonOn = true;
      if (this.levelModel) {
        this.levelModel.controller.levelView.playExplosionAnimation(pos, 2, pos, workingNeighbor.blockType, null, null, this.player);
      }
    } else if (workingNeighbor.blockType !== "" && !workingNeighbor.getIsPistonArm()) {
      // We've actually got something to push.
      let blocksPositions = this.getBlocksToPush(pos, offset);
      let concat = "On";
      if (block.getIsStickyPiston()) {
        concat += "Sticky";
      }
      let onPiston = new LevelBlock(pistonType += concat);
      this.setBlockAt(position, onPiston);
      this.pushBlocks(blocksPositions, offset);
      this.playPistonOn = true;
    } else if (workingNeighbor.blockType === "") {
      // Nothing to push, so just make the arm.
      let concat = "On";
      if (block.getIsStickyPiston()) {
        concat += "Sticky";
        armType += "Sticky";
      }
      let armBlock = new LevelBlock(armType);
      let pistonBlock = new LevelBlock(pistonType += concat);
      this.setBlockAt(pos, armBlock);
      this.setBlockAt(position, pistonBlock);
      this.playPistonOn = true;
    }
  }

  pistonArmBlocked(position, offset) {
    const workingPosition = Position.add(position, offset);
    return this.checkEntityConflict(workingPosition);
  }


  /**
   * Deactivates a piston at a given position by determining what the arm
   * orientation is.
   */
  deactivatePiston(position) {
    const block = this.getBlockAt(position);
    if (!block.getIsPiston() || !block.blockType.match("On")) {
      return;
    }

    const direction = block.getPistonDirection();
    if (direction !== undefined) {
      this.retractArm(Position.forward(position, direction), position);
    }
  }

  /**
  * Does the actual retraction of the arm of a piston.
  */
  retractArm(armPosition, pistonPosition) {
    let emptyBlock = new LevelBlock("");
    let pistonType = this.getBlockAt(pistonPosition);
    let concat = "";
    let blockType = "";
    if (this.getBlockAt(pistonPosition).getIsStickyPiston()) {
      concat = "Sticky";
      blockType = pistonType.blockType.substring(0, pistonType.blockType.length - 8);
    } else {
      blockType = pistonType.blockType.substring(0, pistonType.blockType.length - 2);
    }
    let newPistonType = blockType + concat;
    let offPiston = new LevelBlock(newPistonType);
    if (this.getBlockAt(armPosition).getIsPistonArm()) {
      if (this.getBlockAt(pistonPosition).getIsStickyPiston()) {
        const offset = Position.directionToOffsetPosition(pistonType.getPistonDirection());
        const stuckBlockPosition = Position.add(armPosition, offset);
        if (this.inBounds(stuckBlockPosition) && this.getBlockAt(stuckBlockPosition).isStickable) {
          this.setBlockAt(armPosition, this.getBlockAt(stuckBlockPosition));
          this.setBlockAt(stuckBlockPosition, emptyBlock);
        } else {
          this.setBlockAt(armPosition, emptyBlock);
          this.playPistonOff = true;
        }
      } else {
        this.setBlockAt(armPosition, emptyBlock);
        this.playPistonOff = true;
      }
    }
    this.setBlockAt(pistonPosition, offPiston);
  }

  /**
   * Goes through a list of blocks and shuffles them over 1 index in a given direction.
   *
   * @param {Position[]} blocksPositions
   * @param {Position} [offset=[0, 0]]
   */
  pushBlocks(blocksPositions, offset = [0, 0]) {
    let pistonType = "";
    let redo = false;
    if (offset[0] === 1) {
      pistonType = "pistonArmRight";
    } else if (offset[0] === -1) {
      pistonType = "pistonArmLeft";
    } else {
      if (offset[1] === 1) {
        pistonType = "pistonArmDown";
      } else if (offset[1] === -1) {
        pistonType = "pistonArmUp";
      } else {
        // There is no offset, so we're not putting down anything.
      }
    }
    let armBlock = new LevelBlock(pistonType);
    for (let i = blocksPositions.length - 1; i >= 0; --i) {
      let destination = Position.add(blocksPositions[i], Position.fromArray(offset));
      let block = this.getBlockAt(blocksPositions[i]);
      if (this.inBounds(destination) && this.getBlockAt(destination).isDestroyableUponPush()) {
        if (this.levelModel) {
          this.levelModel.controller.levelView.playExplosionAnimation(destination, 2, destination, block.blockType, null, null, this.player);
        }
        redo = true;
      }
      this.setBlockAt(destination, this.getBlockAt(blocksPositions[i]));
      if (i === 0) {
        this.setBlockAt(blocksPositions[i], armBlock);
      }
    }
    if (redo) {
      this.refreshRedstone();
    }
  }

  /**
   * Returns a list of blocks in a given direction to be shuffled over later.
   * @param {Position} position
   * @param {Position} [offset=[0, 0]]
   */
  getBlocksToPush(position, offset = [0, 0]) {
    let pushingBlocks = [];
    let workingPosition = position;
    while (this.inBounds(workingPosition) && this.getBlockAt(workingPosition).getIsPushable()) {
      pushingBlocks.push(workingPosition);
      workingPosition = Position.add(workingPosition, Position.fromArray(offset));
    }
    return pushingBlocks;
  }

  /**
  * Checking power state for objects that are powered by redstone.
  */
  powerCheck(position, canReadCharge = false) {
    return Position.getOrthogonalPositions(position).some(orthogonalPosition => {
      const block = this.getBlockAt(orthogonalPosition);
      if (block) {
        if (!block.isWeaklyPowerable) {
          return false;
        }
        if (this.getBlockAt(position).getIsPiston()) {
          const piston = this.getBlockAt(position);
          const ignoreThisSide = Position.directionToOffsetPosition(piston.getPistonDirection()) || new Position(0, 0);
          const posCheck = Position.add(position, ignoreThisSide);
          if (Position.equals(orthogonalPosition, posCheck)) {
            return false;
          }
        }
        if (canReadCharge) {
          return block.isPowered || block.isRedstoneBattery;
        }
        return (block.isRedstone && block.isPowered) || block.isRedstoneBattery;
      }
    });
  }

  powerAllBlocks() {
    this.getAllPositions().forEach((position) => {
      const block = this.getBlockAt(position);
      if (block.blockType !== "" && block.canHoldCharge()) {
        block.isPowered = this.powerCheck(position);
      }
    });
  }

  updateWeakCharge(position, block) {
    if (block.isWeaklyPowerable) {
      block.isPowered = this.powerCheck(position);
    }
    if (block.isPowered) {
      Position.getOrthogonalPositions(position).forEach(workingPos => {
        if (this.inBounds(workingPos)) {
          this.getIronDoors(workingPos);
          this.getPistonState(workingPos);
        }
      });
    }
  }

  getConduitRingPositions(position, ringSize) {
    // We could hard code this... but might as well have a method for variable ring sizes just in case.
    let topLeft = new Position(position.x - ringSize, position.y - ringSize);
    let bottomRight = new Position(position.x + ringSize, position.y + ringSize);
    let positionList = [];

    // if both corners are in bounds, then the whole ring ought to be in bounds
    if (!this.inBounds(topLeft) || !this.inBounds(bottomRight)) {
      return positionList;
    }

    let sideLength = ringSize * 2 + 1;

    for (let i = 0; i < sideLength; ++i) {
      for (let j = 0; j < sideLength; ++j) {
        if ((i === 0 || i === sideLength - 1) || (j === 0 || j === sideLength - 1)){
          let newIndex = new Position(topLeft.x + i, topLeft.y + j);
          positionList.push(newIndex);
        }
      }
    }

    return positionList;
  }

  resolveConduitState() {
    this.getAllPositions().forEach((position) => {
      const block = this.getBlockAt(position);
      if (block.blockType === "conduit"){

        var prismarineCount = 0;
        var airCount = 0;
        let prismarineRingSize = 2;
        let airRingSize = 1;

        this.getConduitRingPositions(position, prismarineRingSize).forEach((workingPosition) => {
          const block = this.getBlockAt(workingPosition);
          if (block.blockType === "prismarine") {
            ++prismarineCount;
          }
        });

        this.getConduitRingPositions(position, airRingSize).forEach((workingPosition) => {
          const block = this.getBlockAt(workingPosition);
          if (block.isEmpty) {
            ++airCount;
          }
        });

        if (prismarineCount === this.getRingRequirement(prismarineRingSize) && airCount === this.getRingRequirement(airRingSize) && !block.isActivatedConduit) {
          this.getBlockAt(position).isActivatedConduit = true;
          if (this.levelModel) {
            this.levelModel.controller.levelView.playOpenConduitAnimation(position);
          }
        } else if ((prismarineCount < this.getRingRequirement(prismarineRingSize) || airCount < this.getRingRequirement(airRingSize)) && block.isActivatedConduit) {
          this.getBlockAt(position).isActivatedConduit = false;
          if (this.levelModel) {
            this.levelModel.controller.levelView.playCloseConduitAnimation(position);
          }
        }
      }
    });
  }

  getRingRequirement(ringSize){
    // a ring size of 1 (away from the block itself) would correlate to all
    // orthogonal and diagonal adjacent blocks. 3x3 - 1 (the center) = 8
    return 8 * ringSize;
  }

};
// Hack: `PIXI.canUseNewCanvasBlendModes()` sometimes erroneously returns false.
// It's supported in all browsers we support.
if (window.PIXI) {
  PIXI.canUseNewCanvasBlendModes = () => true;
}

class LevelView {
  constructor(controller) {
    this.controller = controller;
    this.audioPlayer = controller.audioPlayer;
    this.game = controller.game;

    this.baseShading = null;
    this.prismarinePhase = 0;

    this.uniforms = {
      time: {type: '1f', value: 0},
      surface: {type: 'sampler2D', value: null},
      tint: {type: '4fv', value: [67 / 255, 213 / 255, 238 / 255, 1]},
      x: {type: '1f', value: 0},
      y: {type: '1f', value: 0},
    };
    this.waveShader = new Phaser.Filter(this.game, this.uniforms, [`
      precision lowp float;
      varying vec2 vTextureCoord;
      uniform sampler2D uSampler;
      uniform sampler2D surface;
      uniform float time;
      uniform float x;
      uniform float y;
      uniform vec4 tint;

      float overlay(float source, float dest) {
        return dest > 0.5 ? (2.0 * dest * source) : (1.0 - 2.0 * (1.0 - dest) * (1.0 - source));
      }

      vec4 overlay(vec4 source, vec4 dest) {
        return vec4(overlay(source.r, dest.r), overlay(source.g, dest.g), overlay(source.b, dest.b), 1.0);
      }

      void main(void) {
        vec2 relativeCoord = vTextureCoord + vec2(x * 0.9, -y * 0.9);
        float offsetA = sin(relativeCoord.y * 31.0 + time / 18.0) * 0.0014;
        float offsetB = sin(relativeCoord.y * 57.0 + time / 18.0) * 0.0007;
        vec4 base = texture2D(uSampler, vTextureCoord + vec2(0.0, offsetA + offsetB));
        float frame = mod(floor(time / 5.0), 31.0);
        float surfaceOffset = 0.0; //sin(time / 57.0) * 0.01 + sin(time / 31.0) * 0.005;
        vec4 surface = texture2D(
          surface,
          vec2(mod(relativeCoord.x * 2.0, 1.0),
          mod((-relativeCoord.y * 2.0 + frame + surfaceOffset) / 32.0, 1.0))
        );
        gl_FragColor = mix(mix(overlay(base, surface), base, 0.5), tint, 0.3);
      }
    `]);

    this.player = null;
    this.agent = null;
    this.selectionIndicator = null;

    this.groundGroup = null;
    this.shadingGroup = null;
    this.actionGroup = null;
    this.fluffGroup = null;
    this.fowGroup = null;
    this.collectibleItems = [];
    //{sprite : sprite, type : blockType, position : [x,y]}
    this.trees = [];

    this.miniBlocks = {
      bed: "bed",
      boat: "boat",
      bookEnchanted: "book_enchanted",
      bricks: "bricks",
      bucketEmpty: "bucket_empty",
      bucketLava: "bucket_lava",
      milk: "bucket_milk",
      bucketWater: "bucket_water",
      cactus: "cactus",
      carrots: "carrot",
      chest: "chest",
      clay: "clay_ball",
      coal: "coal",
      dirtCoarse: "coarse_dirt",
      cobblestone: "cobblestone",
      compass: "compass",
      blackConcrete: "concrete_black",
      blueConcrete: "concrete_blue",
      brownConcrete: "concrete_brown",
      blackConcretePowder: "concrete_powder_black",
      blueConcretePowder: "concrete_powder_blue",
      brownConcretePowder: "concrete_powder_brown",
      deadbush: "deadbush",
      diamond: "diamond",
      axeDiamond: "diamond_axe",
      pickaxeDiamond: "diamond_pickaxe",
      shovelDiamond: "diamond_shovel",
      dirt: "dirt",
      door: "door",
      doorIron: "door_iron",
      egg: "egg",
      emerald: "emerald",
      flint: "flint",
      flintAndSteel: "flint_and_steel",
      daisy: "flower_daisy",
      dandelion: "flower_dandelion",
      poppy: "flower_rose",
      glowstoneDust: "glowstone_dust",
      ingotGold: "gold_ingot",
      gravel: "gravel",
      gunPowder: "gunpowder",
      hardenedClay: "hardend_clay",
      hardenedClayBlack: "hardened_clay_stained_black",
      hardenedClayBlue: "hardened_clay_stained_blue",
      hardenedClayBrown: "hardened_clay_stained_brown",
      hardenedClayCyan: "hardened_clay_stained_cyan",
      hardenedClayGray: "hardened_clay_stained_gray",
      hardenedClayGreen: "hardened_clay_stained_green",
      hardenedClayLightBlue: "hardened_clay_stained_light_blue",
      hardenedClayLime: "hardened_clay_stained_lime",
      hardenedClayMagenta: "hardened_clay_stained_magenta",
      hardenedClayOrange: "hardened_clay_stained_orange",
      hardenedClayPink: "hardened_clay_stained_pink",
      hardenedClayPurple: "hardened_clay_stained_purple",
      hardenedClayRed: "hardened_clay_stained_red",
      hardenedClaySilver: "hardened_clay_stained_silver",
      hardenedClayWhite: "hardened_clay_stained_white",
      hardenedClayYellow: "hardened_clay_stained_yellow",
      heartofthesea: "heartofthesea_closed",
      ingotIron: "iron_ingot",
      lapisLazuli: "lapis_lazuli",
      logAcacia: "log_acacia",
      logBirch: "log_birch",
      logJungle: "log_jungle",
      logOak: "log_oak",
      logSpruce: "log_spruce",
      mapEmpty: "map_empty",
      minecart: "minecart_normal",
      nautilus: "nautilus",
      netherbrick: "netherbrick",
      netherrack: "netherrack",
      obsidian: "obsidian",
      piston: "piston",
      planksAcacia: "planks_acacia",
      planksBirch: "planks_birch",
      planksJungle: "planks_jungle",
      planksOak: "planks_oak",
      planksSpruce: "planks_spruce",
      potato: "potato",
      potion: "potion_bottle_drinkable",
      pressurePlateOak: "pressure_plate_oak",
      prismarine: "prismarine",
      quartzOre: "quartz",
      railGolden: "rail_golden",
      railNormal: "rail_normal",
      redstoneDust: "redstone_dust",
      redstoneTorch: "redstone_torch",
      reeds: "reeds",
      sand: "sand",
      sandstone: "sandstone",
      seaPickles: "sea_pickle",
      seedsWheat: "seeds_wheat",
      snow: "snow",
      snowBall: "snowball",
      tnt: "tnt",
      torch: "torch",
      turtle: "turtle",
      cropWheat: "wheat",
      wool_black: "wool_colored_black",
      wool_blue: "wool_colored_blue",
      wool_brown: "wool_colored_brown",
      wool_cyan: "wool_colored_cyan",
      wool_gray: "wool_colored_gray",
      wool_green: "wool_colored_green",
      wool_light_blue: "wool_colored_light_blue",
      wool_lime: "wool_colored_lime",
      wool_magenta: "wool_colored_magenta",
      wool_orange: "wool_colored_orange",
      wool_pink: "wool_colored_pink",
      wool_purple: "wool_colored_purple",
      wool_red: "wool_colored_red",
      wool_silver: "wool_colored_silver",
      wool: "wool_colored_white",
      wool_yellow: "wool_colored_yellow",
    };

    this.blocks = {
      "bedrock": ["blocks", "Bedrock", -13, 0],
      "bricks": ["blocks", "Bricks", -13, 0],
      "oreCoal": ["blocks", "Coal_Ore", -13, 0],
      "dirtCoarse": ["blocks", "Coarse_Dirt", -13, 0],
      "cobblestone": ["blocks", "Cobblestone", -13, 0],
      "oreDiamond": ["blocks", "Diamond_Ore", -13, 0],
      "dirt": ["blocks", "Dirt", -13, 0],
      "oreEmerald": ["blocks", "Emerald_Ore", -13, 0],
      "farmlandWet": ["blocks", "Farmland_Wet", -13, 0],
      "flowerDandelion": ["blocks", "Flower_Dandelion", -13, 0],
      "flowerOxeeye": ["blocks", "Flower_Oxeeye", -13, 0],
      "flowerRose": ["blocks", "Flower_Rose", -13, 0],
      "glass": ["blocks", "Glass", -13, 0],
      "oreGold": ["blocks", "Gold_Ore", -13, 0],
      "grass": ["blocks", "Grass", -13, 0],
      "gravel": ["blocks", "Gravel", -13, 0],
      "oreIron": ["blocks", "Iron_Ore", -13, 0],
      "oreLapis": ["blocks", "Lapis_Ore", -13, 0],
      "lava": ["blocks", "Lava_0", -13, 0],
      "logAcacia": ["blocks", "Log_Acacia", -13, 0],
      "logBirch": ["blocks", "Log_Birch", -13, 0],
      "logJungle": ["blocks", "Log_Jungle", -13, 0],
      "logOak": ["blocks", "Log_Oak", -13, 0],
      "logSpruce": ["blocks", "Log_Spruce", -13, 0],
      "logSpruceSnowy": ["blocks", "Log_Spruce", -13, 0],
      "obsidian": ["blocks", "Obsidian", -13, 0],
      "planksAcacia": ["blocks", "Planks_Acacia", -13, 0],
      "planksBirch": ["blocks", "Planks_Birch", -13, 0],
      "planksJungle": ["blocks", "Planks_Jungle", -13, 0],
      "planksOak": ["blocks", "Planks_Oak", -13, 0],
      "planksSpruce": ["blocks", "Planks_Spruce", -13, 0],
      "oreRedstone": ["blocks", "Redstone_Ore", -13, 0],
      "sand": ["blocks", "Sand", -13, 0],
      "sandstone": ["blocks", "Sandstone", -13, 0],
      "stone": ["blocks", "Stone", -13, 0],
      "tnt": ["tnt", "TNTexplosion0", -80, -58],
      "water": ["blocks", "Water_0", -13, 0],
      "wool": ["blocks", "Wool_White", -13, 0],
      "wool_orange": ["blocks", "Wool_Orange", -13, 0],
      "wool_black": ["blocks", "Wool_Black", -13, 0],
      "wool_blue": ["blocks", "Wool_Blue", -13, 0],
      "wool_brown": ["blocks", "Wool_Brown", -13, 0],
      "wool_cyan": ["blocks", "Wool_Cyan", -13, 0],
      "wool_gray": ["blocks", "Wool_Gray", -13, 0],
      "wool_green": ["blocks", "Wool_Green", -13, 0],
      "wool_light_blue": ["blocks", "Wool_LightBlue", -13, 0],
      "wool_lime": ["blocks", "Wool_Lime", -13, 0],
      "wool_magenta": ["blocks", "Wool_Magenta", -13, 0],
      "wool_pink": ["blocks", "Wool_Pink", -13, 0],
      "wool_purple": ["blocks", "Wool_Purple", -13, 0],
      "wool_red": ["blocks", "Wool_Red", -13, 0],
      "wool_silver": ["blocks", "Wool_Silver", -13, 0],
      "wool_yellow": ["blocks", "Wool_Yellow", -13, 0],

      "leavesAcacia": ["leavesAcacia", "Leaves_Acacia0.png", -100, 0],
      "leavesBirch": ["leavesBirch", "Leaves_Birch0.png", -100, 0],
      "leavesJungle": ["leavesJungle", "Leaves_Jungle0.png", -100, 0],
      "leavesOak": ["leavesOak", "Leaves_Oak0.png", -100, 0],
      "leavesSpruce": ["leavesSpruce", "Leaves_Spruce0.png", -100, 0],
      "leavesSpruceSnowy": ["leavesSpruceSnowy", "Leaves_SpruceSnowy0.png", -100, 36],

      "watering": ["blocks", "Water_0", -13, 0],
      "cropWheat": ["blocks", "Wheat0", -13, 0],
      "torch": ["torch", "Torch0", -13, 0],

      "tallGrass": ["blocks", "TallGrass", -13, 0],

      "lavaPop": ["lavaPop", "LavaPop01", -13, 0],
      "redstoneSparkle": ["redstoneSparkle", "redstone_sparkle1.png", 7, 23],
      "fire": ["fire", "", -11, 135],
      "bubbles": ["bubbles", "", -11, 135],
      "explosion": ["explosion", "", -70, 60],

      "door": ["door", "", -12, -15],
      "doorIron": ["doorIron", "", -12, -15],

      "rails": ["blocks", "Rails_Vertical", -13, -0],
      "railsNorthEast": ["blocks", "Rails_BottomLeft", -13, 0],
      "railsNorthWest": ["blocks", "Rails_BottomRight", -13, 0],
      "railsEast": ["blocks", "Rails_Horizontal", -13, 0],
      "railsWest": ["blocks", "Rails_Horizontal", -13, 0],
      "railsEastWest": ["blocks", "Rails_Horizontal", -13, 0],
      "railsSouthEast": ["blocks", "Rails_TopLeft", -13, 0],
      "railsSouthWest": ["blocks", "Rails_TopRight", -13, 0],
      "railsNorth": ["blocks", "Rails_Vertical", -13, -0],
      "railsSouth": ["blocks", "Rails_Vertical", -13, -0],
      "railsNorthSouth": ["blocks", "Rails_Vertical", -13, -0],

      "railsUnpowered": ["blocks", "Rails_UnpoweredVertical", -13, 0],
      "railsUnpoweredNorth": ["blocks", "Rails_UnpoweredVertical", -13, 0],
      "railsUnpoweredSouth": ["blocks", "Rails_UnpoweredVertical", -13, 0],
      "railsUnpoweredNorthSouth": ["blocks", "Rails_UnpoweredVertical", -13, 0],
      "railsUnpoweredEast": ["blocks", "Rails_UnpoweredHorizontal", -13, 0],
      "railsUnpoweredWest": ["blocks", "Rails_UnpoweredHorizontal", -13, 0],
      "railsUnpoweredEastWest": ["blocks", "Rails_UnpoweredHorizontal", -13, 0],

      "railsPowered": ["blocks", "Rails_PoweredVertical", -13, 0],
      "railsPoweredNorth": ["blocks", "Rails_PoweredVertical", -13, 0],
      "railsPoweredSouth": ["blocks", "Rails_PoweredVertical", -13, 0],
      "railsPoweredNorthSouth": ["blocks", "Rails_PoweredVertical", -13, 0],
      "railsPoweredEast": ["blocks", "Rails_PoweredHorizontal", -13, 0],
      "railsPoweredWest": ["blocks", "Rails_PoweredHorizontal", -13, 0],
      "railsPoweredEastWest": ["blocks", "Rails_PoweredHorizontal", -13, 0],

      "railsRedstoneTorch": ["blocks", "Rails_RedstoneTorch", -12, 9],

      "redstoneWire": ["blocks", "redstone_dust_dot_off", -13, 0],
      "redstoneWireHorizontal": ["blocks", "redstone_dust_line_h_off", -13, 0],
      "redstoneWireVertical": ["blocks", "redstone_dust_line_v_off", -13, 0],
      "redstoneWireUpRight": ["blocks", "redstone_dust_corner_BottomLeft_off", -13, 0],
      "redstoneWireUpLeft": ["blocks", "redstone_dust_corner_BottomRight_off", -13, 0],
      "redstoneWireDownRight": ["blocks", "redstone_dust_corner_TopLeft_off", -13, 0],
      "redstoneWireDownLeft": ["blocks", "redstone_dust_corner_TopRight_off", -13, 0],
      "redstoneWireTUp": ["blocks", "redstone_dust_cross_up_off", -13, 0],
      "redstoneWireTDown": ["blocks", "redstone_dust_cross_down_off", -13, 0],
      "redstoneWireTLeft": ["blocks", "redstone_dust_cross_left_off", -13, 0],
      "redstoneWireTRight": ["blocks", "redstone_dust_cross_right_off", -13, 0],
      "redstoneWireCross": ["blocks", "redstone_dust_cross_off", -13, 0],

      "redstoneWireOn": ["blocks", "redstone_dust_dot", -13, 0],
      "redstoneWireHorizontalOn": ["blocks", "redstone_dust_line_h", -13, 0],
      "redstoneWireVerticalOn": ["blocks", "redstone_dust_line_v", -13, 0],
      "redstoneWireUpRightOn": ["blocks", "redstone_dust_corner_BottomLeft", -13, 0],
      "redstoneWireUpLeftOn": ["blocks", "redstone_dust_corner_BottomRight", -13, 0],
      "redstoneWireDownRightOn": ["blocks", "redstone_dust_corner_TopLeft", -13, 0],
      "redstoneWireDownLeftOn": ["blocks", "redstone_dust_corner_TopRight", -13, 0],
      "redstoneWireTUpOn": ["blocks", "redstone_dust_cross_up", -13, 0],
      "redstoneWireTDownOn": ["blocks", "redstone_dust_cross_down", -13, 0],
      "redstoneWireTLeftOn": ["blocks", "redstone_dust_cross_left", -13, 0],
      "redstoneWireTRightOn": ["blocks", "redstone_dust_cross_right", -13, 0],
      "redstoneWireCrossOn": ["blocks", "redstone_dust_cross", -13, 0],

      "pressurePlateUp": ["blocks", "PressurePlate_Up", -13, 0],
      "pressurePlateDown": ["blocks", "PressurePlate_Down", -13, 0],

      "pistonUp": ["blocks", "piston_up", -13, 0],
      "pistonDown": ["blocks", "piston_down", -13, 0],
      "pistonLeft": ["blocks", "piston_left", -13, 0],
      "pistonRight": ["blocks", "piston_right", -13, 0],
      "pistonUpOn": ["blocks", "piston_base_up", -26, -13],
      "pistonDownOn": ["blocks", "piston_base_down", -26, -13],
      "pistonLeftOn": ["blocks", "piston_base_left", -26, -13],
      "pistonRightOn": ["blocks", "piston_base_right", -26, -13],

      "pistonArmLeft": ["blocks", "piston_arm_left", -26, -13],
      "pistonArmRight": ["blocks", "piston_arm_right", -26, -13],
      "pistonArmUp": ["blocks", "piston_arm_up", -26, -13],
      "pistonArmDown": ["blocks", "piston_arm_down", -26, -13],

      "pistonUpSticky": ["blocks", "piston_up", -13, 0],
      "pistonDownSticky": ["blocks", "piston_down_sticky", -13, 0],
      "pistonLeftSticky": ["blocks", "piston_left", -13, 0],
      "pistonRightSticky": ["blocks", "piston_right", -13, 0],
      "pistonUpOnSticky": ["blocks", "piston_base_up", -26, -13],
      "pistonDownOnSticky": ["blocks", "piston_base_down_sticky", -26, -13],
      "pistonLeftOnSticky": ["blocks", "piston_base_left", -26, -13],
      "pistonRightOnSticky": ["blocks", "piston_base_right", -26, -13],

      "pistonArmLeftSticky": ["blocks", "piston_arm_left", -26, -13],
      "pistonArmRightSticky": ["blocks", "piston_arm_right", -26, -13],
      "pistonArmUpSticky": ["blocks", "piston_arm_up", -26, -13],
      "pistonArmDownSticky": ["blocks", "piston_arm_down_sticky", -26, -13],

      "cactus": ["blocks", "cactus", -13, 0],
      "deadBush": ["blocks", "dead_bush", -13, 0],
      "glowstone": ["blocks", "glowstone", -13, 0],
      "grassPath": ["blocks", "grass_path", -13, 0],
      "ice": ["blocks", "ice", -13, 0],
      "netherrack": ["blocks", "netherrack", -13, 0],
      "netherBrick": ["blocks", "nether_brick", -13, 0],
      "quartzOre": ["blocks", "quartz_ore", -13, 0],
      "snow": ["blocks", "snow", -13, 0],
      "snowyGrass": ["blocks", "snowy_grass", -13, 0],
      "topSnow": ["blocks", "top_snow", -13, 0],

      "sandDeep": ["blocks", "Sand_Deep", -13, 0],
      "gravelDeep": ["blocks", "Gravel_Deep", -13, 0],
      "reeds": ["blocks", "Reeds", -13, -18],
      "Nether_Portal": ["blocks", "NetherPortal1", 0, -58],

      //hooking up all old blocks that we had assets for but never used in previous years
      "bedFoot": ["blocks", "Bed_Foot", -13, 0],
      "bedHead": ["blocks", "Bed_Head", -13, 10],
      "clay": ["blocks", "Clay", -13, 0],
      "glassBlack": ["blocks", "Glass_Black", -13, 0],
      "glassBlue": ["blocks", "Glass_Blue", -13, 0],
      "glassBrown": ["blocks", "Glass_Brown", -13, 0],
      "glassCyan": ["blocks", "Glass_Cyan", -13, 0],
      "glassGray": ["blocks", "Glass_Gray", -13, 0],
      "glassGreen": ["blocks", "Glass_Green", -13, 0],
      "glassLightBlue": ["blocks", "Glass_LightBlue", -13, 0],
      "glassLime": ["blocks", "Glass_Lime", -13, 0],
      "glassMagenta": ["blocks", "Glass_Magenta", -13, 0],
      "glassOrange": ["blocks", "Glass_Orange", -13, 0],
      "glassPink": ["blocks", "Glass_Pink", -13, 0],
      "glassPurple": ["blocks", "Glass_Purple", -13, 0],
      "glassRed": ["blocks", "Glass_Red", -13, 0],
      "glassSilver": ["blocks", "Glass_Silver", -13, 0],
      "glassWhite": ["blocks", "Glass_White", -13, 0],
      "glassYellow": ["blocks", "Glass_Yellow", -13, 0],
      "terracotta": ["blocks", "Terracotta", -13, 0],
      "terracottaBlack": ["blocks", "Terracotta_Black", -13, 0],
      "terracottaBlue": ["blocks", "Terracotta_Blue", -13, 0],
      "terracottaBrown": ["blocks", "Terracotta_Brown", -13, 0],
      "terracottaCyan": ["blocks", "Terracotta_Cyan", -13, 0],
      "terracottaGray": ["blocks", "Terracotta_Gray", -13, 0],
      "terracottaGreen": ["blocks", "Terracotta_Green", -13, 0],
      "terracottaLightBlue": ["blocks", "Terracotta_LightBlue", -13, 0],
      "terracottaLime": ["blocks", "Terracotta_Lime", -13, 0],
      "terracottaMagenta": ["blocks", "Terracotta_Magenta", -13, 0],
      "terracottaOrange": ["blocks", "Terracotta_Orange", -13, 0],
      "terracottaPink": ["blocks", "Terracotta_Pink", -13, 0],
      "terracottaPurple": ["blocks", "Terracotta_Purple", -13, 0],
      "terracottaRed": ["blocks", "Terracotta_Red", -13, 0],
      "terracottaSilver": ["blocks", "Terracotta_Silver", -13, 0],
      "terracottaWhite": ["blocks", "Terracotta_White", -13, 0],
      "terracottaYellow": ["blocks", "Terracotta_Yellow", -13, 0],

      // 2018 blocks.
      "strippedOak": ["blocks", "Stripped_Oak", -12, 0],
      "strippedDarkOak": ["blocks", "Stripped_Dark_Oak", -12, 0],
      "stoneBricks": ["blocks", "Stone_Bricks", -12, 0],
      "chiseledStoneBricks": ["blocks", "Stone_Bricks_Chisled", -12, 0],
      "mossyStoneBricks": ["blocks", "Stone_Bricks_Mossy", -12, 0],
      "crackedStoneBricks": ["blocks", "Stone_Bricks_Cracked", -12, 0],
      "magmaBlock": ["blocks", "Magma_Block0", -12, 0],
      "blueCoralBlock": ["blocks", "Coral_Block_Blue", -12, 0],
      "pinkCoralBlock": ["blocks", "Coral_Block_Pink", -12, 0],
      "magentaCoralBlock": ["blocks", "Coral_Block_Magenta", -12, 0],
      "redCoralBlock": ["blocks", "Coral_Block_Red", -12, 0],
      "yellowCoralBlock": ["blocks", "Coral_Block_Yellow", -12, 0],
      "deadCoralBlock": ["blocks", "Coral_Block_Dead_Blue", -12, 0],
      "blueDeadCoralBlock": ["blocks", "Coral_Block_Dead_Blue", -12, 0],
      "pinkDeadCoralBlock": ["blocks", "Coral_Block_Dead_Pink", -12, 0],
      "magentaDeadCoralBlock": ["blocks", "Coral_Block_Dead_Magenta", -12, 0],
      "readDeadCoralBlock": ["blocks", "Coral_Block_Dead_Red", -12, 0],
      "yellowDeadCoralBlock": ["blocks", "Coral_Block_Dead_Yellow", -12, 0],
      "prismarine": ["blocks", "Prismarine0", -12, 0],
      "prismarineBricks": ["blocks", "Prismarine_Bricks", -12, 0],
      "darkPrismarine": ["blocks", "Prismarine_Dark", -12, 0],
      "seaLantern": ["blocks", "Sea_Lantern0", -12, 0],
      "packedIce": ["blocks", "Ice_Packed", -12, 0],
      "blueIce": ["blocks", "Ice_Blue", -12, 0],
      "blackConcrete": ["blocks", "Concrete_Black", -12, 0],
      "seaGrass": ["blocks", "Seagrass0", -12, 0],
      "kelp": ["blocks", "KelpSingle_0", -12, 0],
      "polishedGranite": ["blocks", "Granite_Polished", -12, 0],
      "coralFanBlueBottom": ["blocks", "Coral_Fan_Blue_Bottom", -12, 0],
      "coralFanPinkBottom": ["blocks", "Coral_Fan_Pink_Bottom", -12, 0],
      "coralFanMagentaBottom": ["blocks", "Coral_Fan_Magenta_Bottom", -12, 0],
      "coralFanRedBottom": ["blocks", "Coral_Fan_Red_Bottom", -12, 0],
      "coralFanYellowFanBottom": ["blocks", "Coral_Fan_Yellow_Bottom", -12, 0],
      "coralFanBlueTop": ["blocks", "Coral_Fan_Blue_Top", -12, 0],
      "coralFanPinkTop": ["blocks", "Coral_Fan_Pink_Top", -12, 0],
      "coralFanMagentaTop": ["blocks", "Coral_Fan_Magenta_Top", -12, 0],
      "coralFanRedTop": ["blocks", "Coral_Fan_Red_Top", -12, 0],
      "coralFanYellowFanTop": ["blocks", "Coral_Fan_Yellow_Top", -12, 0],
      "coralFanBlueLeft": ["blocks", "Coral_Fan_Blue_Left", -12, 0],
      "coralFanPinkLeft": ["blocks", "Coral_Fan_Pink_Left", -12, 0],
      "coralFanMagentaLeft": ["blocks", "Coral_Fan_Magenta_Left", -12, 0],
      "coralFanRedLeft": ["blocks", "Coral_Fan_Red_Left", -12, 0],
      "coralFanYellowFanLeft": ["blocks", "Coral_Fan_Yellow_Left", -12, 0],
      "coralFanBlueRight": ["blocks", "Coral_Fan_Blue_Right", -12, 0],
      "coralFanPinkRight": ["blocks", "Coral_Fan_Pink_Right", -12, 0],
      "coralFanMagentaRight": ["blocks", "Coral_Fan_Magenta_Right", -12, 0],
      "coralFanRedRight": ["blocks", "Coral_Fan_Red_Right", -12, 0],
      "coralFanYellowFanRight": ["blocks", "Coral_Fan_Yellow_Right", -12, 0],
      "coralPlantBlue": ["blocks", "Coral_Plant_Blue", -12, 0],
      "coralPlantBlueDeep": ["blocks", "Coral_Plant_Blue_Sand", -12, 0],
      "coralPlantPink": ["blocks", "Coral_Plant_Pink", -12, 0],
      "coralPlantPinkDeep": ["blocks", "Coral_Plant_Pink_Sand", -12, 0],
      "coralPlantMagenta": ["blocks", "Coral_Plant_Magenta", -12, 0],
      "coralPlantMagentaDeep": ["blocks", "Coral_Plant_Magenta_Sand", -12, 0],
      "coralPlantRed": ["blocks", "Coral_Plant_Red", -12, 0],
      "coralPlantRedDeep": ["blocks", "Coral_Plant_Red_Sand", -12, 0],
      "coralPlantYellow": ["blocks", "Coral_Plant_Yellow", -12, 0],
      "coralPlantYellowDeep": ["blocks", "Coral_Plant_Yellow_Sand", -12, 0],
      "magmaUnderwater": ["blocks", "Magma_Bubble_Boat0", -12, 4],
      "magmaDeep": ["blocks", "Magma_Bubble_Deep0", -12, 0],
      "bubbleColumn": ["blocks", "Bubble_Column0", -12, 0],
      "conduit": ["blocks", "Conduit00", -13, -10],

      "seaPickles": ["blocks", "SeaPickle", -10, -30],
      "Chest": ["blocks", "Chest0", -12, -20],
      "chest": ["blocks", "Chest0", -12, -20], // compat
      "invisible": ["blocks", "Invisible", 0, 0],
    };
    this.actionPlaneBlocks = [];
    this.toDestroy = [];
    this.resettableTweens = [];
    this.treeFluffTypes = {

      "treeAcacia": [[0, 0], [-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1], [-1, -2], [0, -2], [1, -2]],
      "treeBirch": [[0, 0], [-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1], [-1, -2], [0, -2], [1, -2], [0, -3]],
      "treeJungle": [[0, 0], [-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1], [-1, -2], [0, -2], [1, -2], [0, -3], [1, -3]],
      "treeOak": [[0, 0], [-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1], [-1, -2], [0, -2], [0, -3]],
      "treeSpruce": [[0, 0], [-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1], [-1, -2], [0, -2], [1, -2], [0, -3]],
      "treeSpruceSnowy": [[0, 0], [-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1], [-1, -2], [0, -2], [1, -2], [0, -3]]
    };
  }

  initPrismarine() {
    if (!this.prismarine) {
      this.prismarine = this.controller.game.make.bitmapData(64, 64, 'prismarine');
      this.prismarineFrames = [];

      for (let i = 0; i < 6; i++) {
        this.prismarineFrames[i] = this.controller.game.make.sprite(0, 0, 'blocks', 'Prismarine' + i);
      }
      this.prismarine.copy(this.prismarineFrames[0]);
    }
  }

  updatePrismarine() {
    const from = Math.floor(this.prismarinePhase);
    const to = Math.ceil(this.prismarinePhase) % 6;
    const blend = this.prismarinePhase - from;
    this.prismarine.copy(this.prismarineFrames[from]);
    if (blend > 0) {
      this.prismarine.copy(this.prismarineFrames[to], null, null, null, null, null, null, null, null, null, null, null, null, null, blend);
    }
  }

  yToIndex(y) {
    return this.controller.levelModel.yToIndex(y);
  }

  create(levelModel) {
    this.createGroups();
    this.reset(levelModel);

    if (levelModel.isUnderwater()) {
      const underwaterOverlay = this.game.add.sprite(0, 0, 'underwaterOverlay');
      underwaterOverlay.visible = false;
      underwaterOverlay.smoothed = false;
      this.uniforms.surface.value = underwaterOverlay.texture;
    }
  }

  resetEntity(entity) {
    this.preparePlayerSprite(entity.name, entity);
    entity.getAnimationManager().stop();
    this.setPlayerPosition(entity.position, entity.isOnBlock, entity);
    if (entity.shouldUpdateSelectionIndicator()) {
      this.setSelectionIndicatorPosition(entity.position[0], entity.position[1]);
      this.selectionIndicator.visible = true;
    }
    this.initWithIdleAnimation(entity.position, entity.facing, entity.isOnBlock, entity);
  }

  reset(levelModel) {
    this.player = levelModel.player;
    this.agent = levelModel.agent;

    this.resettableTweens.forEach((tween) => {
      tween.stop(false);
    });
    this.resettableTweens.length = 0;
    this.collectibleItems = [];
    this.trees = [];

    this.resetGroups(levelModel);

    if (levelModel.usePlayer) {
      this.resetEntity(this.player);

      if (levelModel.usingAgent) {
        this.resetEntity(this.agent);
      }
    }

    if (levelModel.isUnderwater()) {
      if (levelModel.getOceanType() === 'cold') {
        this.uniforms.tint.value = [57 / 255, 56 / 255, 201 / 255, 1];
      }
      this.game.world.filters = [this.waveShader];
    }

    this.updateShadingGroup(levelModel.shadingPlane);
    this.updateFowGroup(levelModel.fowPlane);

    if (this.controller.followingPlayer()) {
      this.game.world.setBounds(0, 0, levelModel.planeWidth * 40, levelModel.planeHeight * 40);
      this.game.camera.follow(this.player.sprite);
      this.game.world.scale.x = 1;
      this.game.world.scale.y = 1;
    } else {
      this.game.world.setBounds(0, 0, 400, 400);
    }
  }

  update() {
    for (let i = 0; i < this.toDestroy.length; ++i) {
      this.toDestroy[i].destroy();
    }
    this.toDestroy = [];

    if (this.prismarine) {
      this.prismarinePhase = (this.prismarinePhase + this.controller.originalFpsToScaled(0.015)) % 6;
      this.updatePrismarine();
    }
  }

  render() {
    this.actionGroup.sort('sortOrder');
    this.fluffGroup.sort('z');

    const view = this.game.camera.view;
    this.uniforms.x.value = view.x / view.width;
    this.uniforms.y.value = view.y / view.height;
    this.uniforms.time.value++;
  }

  scaleShowWholeWorld(completionHandler) {
    var [scaleX, scaleY] = this.controller.scaleFromOriginal();
    var scaleTween = this.addResettableTween(this.game.world.scale).to({
      x: 1 / scaleX,
      y: 1 / scaleY
    }, 1000, Phaser.Easing.Exponential.Out);

    this.game.camera.unfollow();

    var positionTween = this.addResettableTween(this.game.camera).to({
      x: 0,
      y: 0
    }, 1000, Phaser.Easing.Exponential.Out);

    scaleTween.onComplete.addOnce(() => {
      completionHandler();
    });

    positionTween.start();
    scaleTween.start();
  }

  getDirectionName(facing) {
    return "_" + FacingDirection.directionToRelative(facing).toLowerCase();
  }

  playDoorAnimation(position, open, completionHandler) {
    let blockIndex = (this.yToIndex(position[1])) + position[0];
    let block = this.actionPlaneBlocks[blockIndex];
    let animationName = open ? "open" : "close";
    const animation = this.playScaledSpeed(block.animations, animationName);
    this.onAnimationEnd(animation, () => {
      animation.updateCurrentFrame();
      completionHandler();
    });
  }

  playOpenConduitAnimation(position) {
    const blockIndex = (this.yToIndex(position[1])) + position[0];
    const block = this.actionPlaneBlocks[blockIndex];
    const animation = this.playScaledSpeed(block.animations, "activation");
    this.onAnimationEnd(animation, () => {
      this.controller.levelModel.actionPlane.getBlockAt(position).isEmissive = true;
      this.controller.updateShadingPlane();
      this.controller.updateFowPlane();
      this.playScaledSpeed(block.animations, "open");
    });
  }

  playCloseConduitAnimation(position) {
    const blockIndex = (this.yToIndex(position[1])) + position[0];
    const block = this.actionPlaneBlocks[blockIndex];
    const animation = this.playScaledSpeed(block.animations, "deactivation");
    this.onAnimationEnd(animation, () => {
      this.controller.levelModel.actionPlane.getBlockAt(position).isEmissive = false;
      this.controller.updateShadingPlane();
      this.controller.updateFowPlane();
    });
  }

  playOpenChestAnimation(position) {
    const blockIndex = (this.yToIndex(position[1])) + position[0];
    const block = this.actionPlaneBlocks[blockIndex];
    const animation = this.playScaledSpeed(block.animations, "open");
    this.onAnimationEnd(animation, () => {
      const treasure = this.getTreasureTypeFromChest(this.controller.levelModel.actionPlane.getBlockAt(position));
      if (treasure) {
        this.createMiniBlock(position[0], position[1], treasure, {
          collectibleDistance: -1,
          xOffsetRange: 0,
          yOffsetRange: 0,
          isOnBlock: true,
        });
      }
    });
  }

  getTreasureTypeFromChest(blockData) {
    return blockData.blockType.substring(0, blockData.blockType.length - 5);
  }

  playPlayerAnimation(animationName, position, facing, isOnBlock = false, entity = this.player) {
    let direction = this.getDirectionName(facing);
    entity.sprite.sortOrder = this.yToIndex(position[1]) + entity.getSortOrderOffset();

    let animName = animationName + direction;
    return this.playScaledSpeed(entity.getAnimationManager(), animName);
  }

  playIdleAnimation(position, facing, isOnBlock, entity = this.player) {
    const animationName = this.controller.levelModel.isUnderwater() ? "walk" : "idle";
    this.playPlayerAnimation(animationName, position, facing, isOnBlock, entity);
  }

  initWithIdleAnimation(position, facing, isOnBlock, entity = this.player){
    this.playPlayerAnimation("idle", position, facing, isOnBlock, entity);
  }

  playSuccessAnimation(position, facing, isOnBlock, completionHandler, entity = this.player) {
    this.controller.delayBy(250, () => {
      this.audioPlayer.play("success");
      this.onAnimationEnd(this.playPlayerAnimation("celebrate", position, facing, isOnBlock, entity), () => {
        completionHandler();
      });
    });
  }

  playFailureAnimation(position, facing, isOnBlock, completionHandler, entity = this.player) {
    this.controller.delayBy(500, () => {
      this.audioPlayer.play("failure");
      this.onAnimationEnd(this.playPlayerAnimation("fail", position, facing, isOnBlock, entity), () => {
        this.controller.delayBy(800, completionHandler);
      });
    });
  }

  playBumpAnimation(position, facing, isOnBlock, entity = this.player) {
    var animation = this.playPlayerAnimation("bump", position, facing, isOnBlock, entity);
    animation.onComplete.add(() => {
      this.playIdleAnimation(position, facing, isOnBlock, entity);
    });
    return animation;
  }

  playDrownFailureAnimation(position, facing, isOnBlock, completionHandler) {
    var sprite,
      tween;

    this.playPlayerAnimation("fail", position, facing, isOnBlock);
    this.createBlock(this.fluffGroup, position[0], position[1], "bubbles");

    sprite = this.fluffGroup.create(0, 0, "finishOverlay");
    var [scaleX, scaleY] = this.controller.scaleFromOriginal();
    sprite.scale.x = scaleX;
    sprite.scale.y = scaleY;
    sprite.alpha = 0;
    sprite.tint = 0x324bff;

    tween = this.addResettableTween(sprite).to({
      alpha: 0.5,
    }, 200, Phaser.Easing.Linear.None);

    tween.onComplete.add(() => {
      completionHandler();
    });

    tween.start();
  }

  playBurnInLavaAnimation(position, facing, isOnBlock, completionHandler) {
    var sprite,
      tween;

    this.playPlayerAnimation("jumpUp", position, facing, isOnBlock);
    this.createBlock(this.fluffGroup, position[0], position[1], "fire");

    sprite = this.fluffGroup.create(0, 0, "finishOverlay");
    var [scaleX, scaleY] = this.controller.scaleFromOriginal();
    sprite.scale.x = scaleX;
    sprite.scale.y = scaleY;
    sprite.alpha = 0;
    sprite.tint = 0xd1580d;

    tween = this.addResettableTween(sprite).to({
      alpha: 0.5,
    }, 200, Phaser.Easing.Linear.None);

    tween.onComplete.add(() => {
      completionHandler();
    });

    tween.start();
  }

  playDestroyTntAnimation(position, facing, isOnBlock, tntArray, newShadingPlaneData, completionHandler) {
    var block,
      lastAnimation;
    if (tntArray.length === 0) {
      completionHandler();
      return;
    }

    this.audioPlayer.play("fuse");
    for (var tnt in tntArray) {
      block = this.actionPlaneBlocks[this.coordinatesToIndex(tntArray[tnt])];
      lastAnimation = this.playScaledSpeed(block.animations, "explode");
    }

    this.onAnimationEnd(lastAnimation, () => {
      this.audioPlayer.play("explode");
      completionHandler();
    });
  }

  playCreeperExplodeAnimation(position, facing, destroyPosition, isOnBlock, completionHandler) {
    this.controller.delayBy(180, () => {
      //this.onAnimationLoopOnce(
      this.playPlayerAnimation("bump", position, facing, false).onComplete.add(() => {
        //add creeper windup sound
        this.audioPlayer.play("fuse");
        this.playExplodingCreeperAnimation(position, facing, destroyPosition, isOnBlock, completionHandler, this);

        this.controller.delayBy(200, () => {
          this.onAnimationLoopOnce(this.playPlayerAnimation("jumpUp", position, facing, false), () => {
            this.playIdleAnimation(position, facing, isOnBlock);
          });
        });
      });
    });
  }
  // flash
  flashEntity(entity) {
    return this.flashSpriteToWhite(entity.sprite);
  }

  flashBlock(position) {
    let blockIndex = (this.yToIndex(position[1])) + position[0];
    let block = this.actionPlaneBlocks[blockIndex];
    return this.flashSpriteToWhite(block);
  }

  flashSpriteToWhite(sprite) {
    var fillBmd = this.game.add.bitmapData(sprite.width, sprite.height);
    fillBmd.fill(0xFF, 0xFF, 0xFF, 0xFF);
    var maskedBmd = this.game.add.bitmapData(sprite.width, sprite.height);

    var srcRect = { x: 0, y: 0, width: sprite.width, height: sprite.height };
    var dstRect = { x: 0, y: 0, width: sprite.texture.crop.width, height: sprite.texture.crop.height };
    maskedBmd.alphaMask(fillBmd, sprite, srcRect, dstRect);

    var flashSprite = sprite.addChild(this.game.make.sprite(0, 0, maskedBmd.texture));
    flashSprite.alpha = 0;
    var fadeMs = 60;
    var pauseMs = fadeMs * 4;
    var totalIterations = 3;
    var totalDuration = 0;
    var aIn = { alpha: 1.0 };
    var aOut = { alpha: 0.0 };
    var fadeIn = this.game.add.tween(flashSprite).to(aIn, fadeMs, Phaser.Easing.Linear.None);
    var fadeOut = this.game.add.tween(flashSprite).to(aOut, fadeMs, Phaser.Easing.Linear.None);
    totalDuration = fadeMs * 2;
    fadeIn.chain(fadeOut);
    var lastStep = fadeOut;

    for (var i = 0; i < totalIterations - 1; i++) {
      var innerPause = this.game.add.tween(flashSprite).to(aOut, pauseMs, Phaser.Easing.Linear.None);
      var innerFadeIn = this.game.add.tween(flashSprite).to(aIn, fadeMs, Phaser.Easing.Linear.None);
      var innerFadeOut = this.game.add.tween(flashSprite).to(aOut, fadeMs, Phaser.Easing.Linear.None);
      totalDuration += pauseMs + fadeMs * 2;
      lastStep.chain(innerPause);
      innerPause.chain(innerFadeIn);
      innerFadeIn.chain(innerFadeOut);
      lastStep = innerFadeOut;
    }

    lastStep.onComplete.add(() => {
      flashSprite.destroy();
    });

    fadeIn.start();

    return totalDuration * 2;
  }

  playExplodingCreeperAnimation(position, facing, destroyPosition, isOnBlock, completionHandler) {
    let blockIndex = (this.yToIndex(destroyPosition[1])) + destroyPosition[0];
    let blockToExplode = this.actionPlaneBlocks[blockIndex];

    var creeperExplodeAnimation = blockToExplode.animations.getAnimation("explode");
    creeperExplodeAnimation.onComplete.add(() => {
      blockToExplode.kill();
      this.playExplosionAnimation(position, facing, destroyPosition, isOnBlock, () => {
        this.controller.delayBy(100, () => {
          this.playFailureAnimation(position, facing, false, completionHandler);
        });
      }, false);
      this.audioPlayer.play("explode");
      this.playExplosionCloudAnimation(destroyPosition);
    });

    creeperExplodeAnimation.play();
  }

  playExplosionCloudAnimation(position) {
    this.createBlock(this.fluffGroup, position[0], position[1], "explosion");
  }

  coordinatesToIndex(coordinates) {
    return (this.yToIndex(coordinates[1])) + coordinates[0];
  }

  playMinecartTurnAnimation(position, isUp, isOnBlock, completionHandler, turnDirection) {
    const facing = isUp ? FacingDirection.North : FacingDirection.South;
    var animation = this.playPlayerAnimation("mineCart_turn" + turnDirection, position, facing, false);
    return animation;
  }

  playMinecartMoveForwardAnimation(position, facing, isOnBlock, completionHandler, nextPosition, speed) {
    var tween;

    //if we loop the sfx that might be better?
    this.audioPlayer.play("minecart");
    this.playPlayerAnimation("mineCart", position, facing, false);
    tween = this.addResettableTween(this.player.sprite).to(
      this.positionToScreen(nextPosition), speed, Phaser.Easing.Linear.None);
    tween.start();
    this.player.sprite.sortOrder = this.yToIndex(nextPosition[1]) + 10;

    return tween;
  }

  playMinecartAnimation(isOnBlock, completionHandler) {
    //start at 3,2
    const position = new Position(3, 2);
    this.setPlayerPosition(position, isOnBlock);
    this.player.facing = 2;

    const animation = this.playLevelEndAnimation(position, this.player.facing, isOnBlock, completionHandler, false);
    this.game.world.setBounds(0, 0, 440, 400);
    this.game.camera.follow(this.player.sprite);

    animation.onComplete.add(() => {
      this.playTrack(position, this.player.facing, isOnBlock, this.player, completionHandler);
    });
  }

  playTrack(position, facing, isOnBlock, entity = this.player, completionHandler) {
    entity.onTracks = true;

    // Need to get track on current position to avoid mishandling immediate turns
    let track = this.controller.levelModel.actionPlane.getMinecartTrack(position, facing);

    let nextPos = Position.forward(entity.position, facing);

    if (entity.getOffTrack || (!track && !this.isFirstTimeOnRails(position, nextPos))) {
      entity.getOffTrack = false;
      entity.onTracks = false;
      if (completionHandler) {
        completionHandler();
      }
      return;
    }

    // If track is undefined, it means the player was not on a rail
    // but if we reached this, that means we're trying to get on a rail for the first time
    // and we need to grab that track -in front of us-
    if (track === undefined) {
      track = this.controller.levelModel.actionPlane.getMinecartTrack(nextPos, facing);
      // Having a weird bug on publish where rail destruction while riding causes a destructure of
      // non-iterable instance error. If getTrack fails with currPos and nextPos, just call the whole thing off.
      // so that we don't reach the const assignment below.
      if (track === undefined) {
        entity.getOffTrack = false;
        entity.onTracks = false;
        if (completionHandler) {
          completionHandler();
        }
        return;
      }
    }

    let direction;
    const [arraydirection, nextPosition, nextFacing, speed] = track;
    this.player.position = nextPosition;

    //turn
    if (arraydirection.substring(0, 4) === "turn") {
      direction = arraydirection.substring(5);
      const isUp = facing === FacingDirection.North || nextFacing === FacingDirection.North;
      this.onAnimationEnd(this.playMinecartTurnAnimation(position, isUp, isOnBlock, completionHandler, direction), () => {
        this.playTrack(nextPosition, nextFacing, isOnBlock, entity, completionHandler);
      });
    } else {
      this.onAnimationEnd(this.playMinecartMoveForwardAnimation(position, facing, isOnBlock, completionHandler, nextPosition, speed), () => {
        this.playTrack(nextPosition, nextFacing, isOnBlock, entity, completionHandler);
      });
    }
  }

  /**
  * Handling the first case of walking onto a track while not currently on one
  */
  isFirstTimeOnRails(currPos, nextPos) {
    let nextBlock = this.controller.levelModel.actionPlane.getBlockAt(nextPos);
    let currBlock = this.controller.levelModel.actionPlane.getBlockAt(currPos);
    if ((nextBlock && currBlock) && (!currBlock.isRail && nextBlock.isRail)) {
      return true;
    }
    return false;
  }

  addHouseBed(bottomCoordinates) {
    //Temporary, will be replaced by bed blocks
    var bedTopCoordinate = (bottomCoordinates[1] - 1);
    var sprite = this.actionGroup.create(38 * bottomCoordinates[0], 35 * bedTopCoordinate, "bed");
    sprite.sortOrder = this.yToIndex(bottomCoordinates[1]);
  }

  addDoor(coordinates) {
    var sprite;
    let toDestroy = this.actionPlaneBlocks[this.coordinatesToIndex(coordinates)];
    this.createActionPlaneBlock(coordinates, "door");
    //Need to grab the correct blocktype from the action layer
    //And use that type block to create the ground block under the door
    sprite = this.createBlock(this.groundGroup, coordinates[0], coordinates[1], "wool_orange");
    toDestroy.kill();
    sprite.sortOrder = this.yToIndex(6);
  }

  playSuccessHouseBuiltAnimation(position, facing, isOnBlock, createFloor, houseObjectPositions, completionHandler, updateScreen) {
    //fade screen to white
    //Add house blocks
    //fade out of white
    //Play success animation on player.
    var tweenToW = this.playLevelEndAnimation(position, facing, isOnBlock, () => {
      this.controller.delayBy(4000, completionHandler);
    }, true);
    tweenToW.onComplete.add(() => {
      this.audioPlayer.play("houseSuccess");
      //Change house ground to floor
      var xCoord;
      var yCoord;
      var sprite;

      for (var i = 0; i < createFloor.length; ++i) {
        xCoord = createFloor[i][1];
        yCoord = createFloor[i][2];
        /*this.groundGroup._data[this.coordinatesToIndex([xCoord,yCoord])].kill();*/
        sprite = this.createBlock(this.groundGroup, xCoord, yCoord, "wool_orange");
        sprite.sortOrder = this.yToIndex(yCoord);
      }

      this.addHouseBed(houseObjectPositions[0]);
      this.addDoor(houseObjectPositions[1]);
      this.groundGroup.sort('sortOrder');
      updateScreen();
    });
  }

  //Tweens in and then out of white. returns the tween to white for adding callbacks
  playLevelEndAnimation(position, facing, isOnBlock, completionHandler, playSuccessAnimation) {
    var sprite,
      tweenToW,
      tweenWToC;

    sprite = this.fluffGroup.create(0, 0, "finishOverlay");
    var [scaleX, scaleY] = this.controller.scaleFromOriginal();
    sprite.scale.x = scaleX;
    sprite.scale.y = scaleY;
    sprite.alpha = 0;

    tweenToW = this.tweenToWhite(sprite);
    tweenWToC = this.tweenFromWhiteToClear(sprite);

    tweenToW.onComplete.add(() => {
      this.selectionIndicator.visible = false;
      this.setPlayerPosition(position, isOnBlock);
      tweenWToC.start();
    });
    if (playSuccessAnimation) {
      tweenWToC.onComplete.add(() => {
        this.playSuccessAnimation(position, facing, isOnBlock, completionHandler);
      });
    }
    tweenToW.start();

    return tweenToW;
  }

  tweenFromWhiteToClear(sprite) {
    var tweenWhiteToClear;

    tweenWhiteToClear = this.addResettableTween(sprite).to({
      alpha: 0.0,
    }, 700, Phaser.Easing.Linear.None);
    return tweenWhiteToClear;
  }

  tweenToWhite(sprite) {
    var tweenToWhite;

    tweenToWhite = this.addResettableTween(sprite).to({
      alpha: 1.0,
    }, 300, Phaser.Easing.Linear.None);
    return tweenToWhite;
  }

  playBlockSound(groundType) {
    if (groundType === "water" || groundType === "lava" || this.controller.levelModel.isUnderwater()) {
      return;
    }
    const oreString = groundType.substring(0, 3);
    if (groundType === "stone" || groundType === "cobblestone" || groundType === "bedrock" ||
      oreString === "ore" || groundType === "bricks") {
      this.audioPlayer.play("stepStone");
    } else if (groundType === "grass" || groundType === "dirt" || groundType === "dirtCoarse" ||
      groundType === "wool_orange" || groundType === "wool") {
      this.audioPlayer.play("stepGrass");
    } else if (groundType === "gravel") {
      this.audioPlayer.play("stepGravel");
    } else if (groundType === "farmlandWet") {
      this.audioPlayer.play("stepFarmland");
    } else {
      this.audioPlayer.play("stepWood");
    }
  }

  /**
   * Play the MoveForward animation for the given entity. Note that both
   * MoveForward and MoveBackward are implemented using the same walk
   * animations, and the only difference between the two is the logic they use
   * for moving north after placing a block
   *
   * @see LevelView.playWalkAnimation
   */
  playMoveForwardAnimation(entity, oldPosition, facing, shouldJumpDown, isOnBlock, groundType, completionHandler) {
    // make sure to render high for when moving north after placing a block
    const targetYIndex = entity.position[1] + (facing === FacingDirection.North ? 1 : 0);
    this.playWalkAnimation(entity, oldPosition, facing, shouldJumpDown, isOnBlock, groundType, targetYIndex, completionHandler);
  }

  /**
   * @see LevelView.playMoveForwardAnimation
   */
  playMoveBackwardAnimation(entity, oldPosition, facing, shouldJumpDown, isOnBlock, groundType, completionHandler) {
    // make sure to render high for when moving north after placing a block
    const targetYIndex = entity.position[1] + (facing === FacingDirection.South ? 1 : 0);
    this.playWalkAnimation(entity, oldPosition, facing, shouldJumpDown, isOnBlock, groundType, targetYIndex, completionHandler);
  }

  playWalkAnimation(entity, oldPosition, facing, shouldJumpDown, isOnBlock, groundType, targetYIndex, completionHandler) {
    let tween;
    let position = entity.position;

    //stepping on stone sfx
    this.playBlockSound(groundType);

    if (entity.shouldUpdateSelectionIndicator()) {
      this.setSelectionIndicatorPosition(position[0], position[1]);
    }

    if (!shouldJumpDown) {
      this.playPlayerAnimation('walk', oldPosition, facing, isOnBlock, entity);
      tween = this.addResettableTween(entity.sprite).to(
        this.positionToScreen(position, isOnBlock, entity), 180, Phaser.Easing.Linear.None);
    } else {
      tween = this.playPlayerJumpDownVerticalAnimation(facing, position, oldPosition);
    }

    // Update the sort order 3/4 of the way through the animation
    tween.onUpdateCallback((tween, percent) => {
      if (percent >= 0.75) {
        entity.sprite.sortOrder = this.yToIndex(targetYIndex) + entity.getSortOrderOffset();
        tween.onUpdateCallback(null);
      }
    });

    tween.onComplete.add(() => {
      completionHandler();
    });

    tween.start();
  }

  /**
   * Animate the player jumping down from on top of a block to ground level.
   * @param {FacingDirection} facing
   * @param {Array<int>}position
   * @param {?Array<int>} oldPosition
   * @return {Phaser.Tween}
   */
  playPlayerJumpDownVerticalAnimation(facing, position, oldPosition = position) {
    if (!this.controller.levelModel.isUnderwater()) {
      const animName = "jumpDown" + this.getDirectionName(facing);
      this.playScaledSpeed(this.player.getAnimationManager(), animName);
    }

    const start = this.positionToScreen(oldPosition);
    const end = this.positionToScreen(position);
    const tween = this.addResettableTween(this.player.sprite).to({
      x: [start.x, end.x, end.x],
      y: [start.y, end.y - 50, end.y],
    }, 300, Phaser.Easing.Linear.None).interpolation((v, k) => {
      return Phaser.Math.bezierInterpolation(v, k);
    });
    tween.onComplete.addOnce(() => {
      this.audioPlayer.play("fall");
    });
    tween.start();

    return tween;
  }

  playPlaceBlockAnimation(position, facing, blockType, blockTypeAtPosition, entity, completionHandler) {
    let blockIndex = this.yToIndex(position[1]) + position[0];

    if (entity.shouldUpdateSelectionIndicator()) {
      this.setSelectionIndicatorPosition(position[0], position[1]);
    }

    if (entity === this.agent || LevelBlock.isWalkable(blockType)) {
      var signalDetacher = this.playPlayerAnimation("punch", position, facing, false, entity).onComplete.add(() => {
        signalDetacher.detach();
        completionHandler();
      });
    } else {
      this.audioPlayer.play("placeBlock");

      let direction = this.getDirectionName(facing);

      if (blockTypeAtPosition !== "") {
        this.playExplosionAnimation(position, facing, position, blockTypeAtPosition, (() => {
        }), false);
      }

      if (!this.controller.levelModel.isUnderwater()) {
        this.playScaledSpeed(this.player.getAnimationManager(), "jumpUp" + direction);
      }
      var placementTween = this.addResettableTween(this.player.sprite).to({
        y: (-55 + 40 * position[1])
      }, 125, Phaser.Easing.Cubic.EaseOut);

      placementTween.onComplete.addOnce(() => {
        placementTween = null;

        if (blockTypeAtPosition !== "") {
          this.actionPlaneBlocks[blockIndex].kill();
        }
        completionHandler();
      });
      placementTween.start();
    }
  }

  playPlaceBlockInFrontAnimation(entity = this.player, playerPosition, facing, blockPosition, completionHandler) {
    this.setSelectionIndicatorPosition(blockPosition[0], blockPosition[1]);

    this.playPlayerAnimation("punch", playerPosition, facing, false, entity).onComplete.addOnce(() => {
      completionHandler();
    });
  }

  correctForShadowOverlay(blockType, sprite) {
    if (blockType.startsWith("piston")) {
      sprite.sortOrder -= 0.1;
    }
  }

  createActionPlaneBlock(position, blockType) {
    const block = new LevelBlock(blockType);
    const blockIndex = (this.yToIndex(position[1])) + position[0];

    // Remove the old sprite at this position, if there is one.
    this.actionGroup.remove(this.actionPlaneBlocks[blockIndex]);
    this.groundGroup.remove(this.actionPlaneBlocks[blockIndex]);

    if (block.isEmpty) {
      this.actionPlaneBlocks[blockIndex] = null;
      return;
    }

    // Create a new sprite.
    let sprite;
    if (block.getIsMiniblock()) {
      // miniblocks defined on the action plane like this should have a
      // closer collectible range and a narrower drop offset than normal
      sprite = this.createMiniBlock(position[0], position[1], blockType, {
        collectibleDistance: 1,
        xOffsetRange: 10,
        yOffsetRange: 10
      });
    } else {
      const group = block.shouldRenderOnGroundPlane() ? this.groundGroup : this.actionGroup;
      const offset = block.shouldRenderOnGroundPlane() ? -0.5 : 0;
      if (block.getIsChestblock()){
        // if this is a treasure chest, render a normal chest and blockType will be used later to determine treasure type
        sprite = this.createBlock(group, position[0], position[1] + offset, "Chest");
      } else {
        sprite = this.createBlock(group, position[0], position[1] + offset, blockType);
      }
    }

    if (sprite) {
      sprite.sortOrder = this.yToIndex(position[1]);
      this.correctForShadowOverlay(blockType, sprite);
    }

    this.actionPlaneBlocks[blockIndex] = sprite;
  }

  playShearAnimation(playerPosition, facing, destroyPosition, blockType, completionHandler) {
    let blockIndex = this.yToIndex(destroyPosition[1]) + destroyPosition[0];
    let blockToShear = this.actionPlaneBlocks[blockIndex];

    blockToShear.animations.stop(null, true);
    this.onAnimationLoopOnce(this.playScaledSpeed(blockToShear.animations, "used"), () => {
      this.playScaledSpeed(blockToShear.animations, "face");
    });

    this.playExplosionAnimation(playerPosition, facing, destroyPosition, blockType, completionHandler, true);
  }

  playShearSheepAnimation(playerPosition, facing, destroyPosition, blockType, completionHandler) {
    this.setSelectionIndicatorPosition(destroyPosition[0], destroyPosition[1]);

    this.onAnimationEnd(this.playPlayerAnimation("punch", playerPosition, facing, false), () => {
      let blockIndex = (this.yToIndex(destroyPosition[1])) + destroyPosition[0];
      let blockToShear = this.actionPlaneBlocks[blockIndex];

      blockToShear.animations.stop(null, true);
      this.onAnimationLoopOnce(this.playScaledSpeed(blockToShear.animations, "used"), () => {
        this.playScaledSpeed(blockToShear.animations, "face");
      });

      this.playExplosionAnimation(playerPosition, facing, destroyPosition, blockType, completionHandler, true);
    });
  }

  destroyBlockWithoutPlayerInteraction(destroyPosition) {
    let blockIndex = (this.yToIndex(destroyPosition[1])) + destroyPosition[0];
    let blockToDestroy = this.actionPlaneBlocks[blockIndex];

    let destroyOverlay = this.actionGroup.create(-12 + 40 * destroyPosition[0], -22 + 40 * destroyPosition[1], "destroyOverlay", "destroy1");
    destroyOverlay.sortOrder = this.yToIndex(destroyPosition[1]) + 2;
    this.onAnimationEnd(destroyOverlay.animations.add("destroy", Phaser.Animation.generateFrameNames("destroy", 1, 12, "", 0), 30, false), () => {
      this.actionPlaneBlocks[blockIndex] = null;

      if (blockToDestroy.hasOwnProperty("onBlockDestroy")) {
        blockToDestroy.onBlockDestroy(blockToDestroy);
      }

      blockToDestroy.kill();
      destroyOverlay.kill();
      this.toDestroy.push(blockToDestroy);
      this.toDestroy.push(destroyOverlay);
      this.audioPlayer.play('dig_wood1');
    });

    this.playScaledSpeed(destroyOverlay.animations, "destroy");
  }

  playDestroyBlockAnimation(playerPosition, facing, destroyPosition, blockType, entity, completionHandler) {
    if (entity.shouldUpdateSelectionIndicator()) {
      this.setSelectionIndicatorPosition(destroyPosition[0], destroyPosition[1]);
    }

    var playerAnimation = undefined;
    if (entity === this.agent || this.controller.levelModel.isUnderwater()) {
      playerAnimation = "punchDestroy";
    } else {
      playerAnimation = blockType.match(/(ore|stone|clay|bricks|bedrock)/) ? "mine" : "punchDestroy";
    }
    this.playPlayerAnimation(playerAnimation, playerPosition, facing, false, entity);
    this.playMiningParticlesAnimation(facing, destroyPosition);
    this.playBlockDestroyOverlayAnimation(playerPosition, facing, destroyPosition, blockType, entity, completionHandler);
  }

  playPunchDestroyAirAnimation(playerPosition, facing, destroyPosition, completionHandler, entity = this.player) {
    this.playPunchAnimation(playerPosition, facing, destroyPosition, "punchDestroy", completionHandler, entity);
  }

  playPunchAirAnimation(playerPosition, facing, destroyPosition, completionHandler, entity = this.player) {
    this.playPunchAnimation(playerPosition, facing, destroyPosition, "punch", completionHandler, entity);
  }

  playPunchAnimation(playerPosition, facing, destroyPosition, animationType, completionHandler, entity = this.player) {
    if (entity.shouldUpdateSelectionIndicator()) {
      this.setSelectionIndicatorPosition(destroyPosition[0], destroyPosition[1]);
    }
    this.onAnimationEnd(this.playPlayerAnimation(animationType, playerPosition, facing, false, entity), () => {
      completionHandler();
    });
  }

  /**
   * Play the block Destroy Overlay animation. As a side effect, also actually
   * destroy the block in the level model, update the visualization, and play
   * the block Explision animation.
   *
   * Note that if the block is of a type that does not require an overlay
   * animation, this method (confusingly) simply calls the side effects
   * immediately.
   */
  playBlockDestroyOverlayAnimation(playerPosition, facing, destroyPosition, blockType, entity, completionHandler) {
    const blockIndex = (this.yToIndex(destroyPosition[1])) + destroyPosition[0];
    const blockToDestroy = this.actionPlaneBlocks[blockIndex];

    const afterDestroy = () => {
      if (blockToDestroy.hasOwnProperty("onBlockDestroy")) {
        blockToDestroy.onBlockDestroy(blockToDestroy);
      }

      this.controller.levelModel.destroyBlockForward(entity);
      this.controller.updateShadingPlane();
      this.controller.updateFowPlane();

      if (entity.shouldUpdateSelectionIndicator()) {
        this.setSelectionIndicatorPosition(playerPosition[0], playerPosition[1]);
      }

      this.audioPlayer.play('dig_wood1');
      this.playExplosionAnimation(playerPosition, facing, destroyPosition, blockType, completionHandler, true, entity);
    };

    if (LevelBlock.skipsDestructionOverlay(blockType)) {
      // "flat" blocks are by definition not cube shaped and so shouldn't accept
      // the cube-shaped destroy overlay animation. In this case, destroy the
      // block immediately without waiting for the animation.
      afterDestroy();
    } else {
      const destroyOverlay = this.actionGroup.create(-12 + 40 * destroyPosition[0], -22 + 40 * destroyPosition[1], "destroyOverlay", "destroy1");
      if (LevelBlock.isFlat(blockType)) {
        const cropRect = new Phaser.Rectangle(0, 0, 60, 40);
        destroyOverlay.position.y += 20;
        destroyOverlay.crop(cropRect);
      }
      destroyOverlay.sortOrder = this.yToIndex(destroyPosition[1]) + 2;
      this.onAnimationEnd(destroyOverlay.animations.add("destroy", Phaser.Animation.generateFrameNames("destroy", 1, 12, "", 0), 30, false), () => {
        destroyOverlay.kill();
        this.toDestroy.push(destroyOverlay);

        afterDestroy();
      });
      this.playScaledSpeed(destroyOverlay.animations, "destroy");
    }
  }

  playMiningParticlesAnimation(facing, destroyPosition) {
    let miningParticlesData = [
      [24, -100, -80],   // left
      [12, -120, -80],   // bottom
      [0, -60, -80],   // right
      [36, -80, -60],   // top
    ];

    let direction = this.getDirectionName(facing);
    let miningParticlesIndex = (direction === "_left" ? 0 : direction === "_bottom" ? 1 : direction === "_right" ? 2 : 3);
    let miningParticlesFirstFrame = miningParticlesData[miningParticlesIndex][0];
    let miningParticlesOffsetX = miningParticlesData[miningParticlesIndex][1];
    let miningParticlesOffsetY = miningParticlesData[miningParticlesIndex][2];
    let miningParticles = this.actionGroup.create(miningParticlesOffsetX + 40 * destroyPosition[0], miningParticlesOffsetY + 40 * destroyPosition[1], "miningParticles", "MiningParticles" + miningParticlesFirstFrame);
    miningParticles.sortOrder = this.yToIndex(destroyPosition[1]) + 2;
    this.onAnimationEnd(miningParticles.animations.add("miningParticles", Phaser.Animation.generateFrameNames("MiningParticles", miningParticlesFirstFrame, miningParticlesFirstFrame + 11, "", 0), 30, false), () => {
      miningParticles.kill();
      this.toDestroy.push(miningParticles);
    });
    this.playScaledSpeed(miningParticles.animations, "miningParticles");
  }

  playExplosionAnimation(playerPosition, facing, destroyPosition, blockType, completionHandler, placeBlock, entity = this.player) {
    var explodeAnim = this.actionGroup.create(-36 + 40 * destroyPosition[0], -30 + 40 * destroyPosition[1], "blockExplode", "BlockBreakParticle0");

    switch (blockType) {
      case "treeAcacia":
      case "logAcacia":
        explodeAnim.tint = 0x6c655a;
        break;
      case "treeBirch":
      case "logBirch":
        explodeAnim.tint = 0xdad6cc;
        break;
      case "treeJungle":
      case "logJungle":
        explodeAnim.tint = 0x6a4f31;
        break;
      case "treeOak":
      case "logOak":
        explodeAnim.tint = 0x675231;
        break;
      case "treeSpruce":
      case "logSpruce":
        explodeAnim.tint = 0x4b3923;
        break;
      case "planksAcacia":
        explodeAnim.tint = 0xba6337;
        break;
      case "planksBirch":
        explodeAnim.tint = 0xd7cb8d;
        break;
      case "planksJungle":
        explodeAnim.tint = 0xb88764;
        break;
      case "planksOak":
        explodeAnim.tint = 0xb4905a;
        break;
      case "planksSpruce":
        explodeAnim.tint = 0x805e36;
        break;
      case "stone":
      case "oreCoal":
      case "oreDiamond":
      case "oreIron":
      case "oreGold":
      case "oreEmerald":
      case "oreRedstone":
        explodeAnim.tint = 0xC6C6C6;
        break;
      case "grass":
      case "cropWheat":
        explodeAnim.tint = 0x5d8f23;
        break;
      case "dirt":
        explodeAnim.tint = 0x8a5e33;
        break;

      case "redstoneWireOn":
      case "redstoneWireHorizontalOn":
      case "redstoneWireVerticalOn":
      case "redstoneWireUpRightOn":
      case "redstoneWireUpLeftOn":
      case "redstoneWireDownRightOn":
      case "redstoneWireDownLeftOn":
      case "redstoneWireTUpOn":
      case "redstoneWireTDownOn":
      case "redstoneWireTLeftOn":
      case "redstoneWireTRightOn":
      case "redstoneWireCrossOn":
        explodeAnim.tint = 0x990707;
        break;

      case "redstoneWire":
      case "redstoneWireHorizontal":
      case "redstoneWireVertical":
      case "redstoneWireUpRight":
      case "redstoneWireUpLeft":
      case "redstoneWireDownRight":
      case "redstoneWireDownLeft":
      case "redstoneWireTUp":
      case "redstoneWireTDown":
      case "redstoneWireTLeft":
      case "redstoneWireTRight":
      case "redstoneWireCross":
        explodeAnim.tint = 0x290202;
        break;

      default:
        break;
    }

    explodeAnim.sortOrder = this.yToIndex(destroyPosition[1]) + 2;
    this.onAnimationEnd(explodeAnim.animations.add("explode", Phaser.Animation.generateFrameNames("BlockBreakParticle", 0, 7, "", 0), 30, false), () => {
      explodeAnim.kill();
      this.toDestroy.push(explodeAnim);

      if (placeBlock) {
        if (!this.controller.getIsDirectPlayerControl()) {
          this.playPlayerAnimation("idle", playerPosition, facing, false, entity);
        }
        if (completionHandler !== null) {
          this.playItemDropAnimation(destroyPosition, blockType, completionHandler);
        }
      }
    });
    this.playScaledSpeed(explodeAnim.animations, "explode");
    if (this.controller.getIsDirectPlayerControl() ^ !placeBlock) {
      if (completionHandler) {
        completionHandler();
      }
    }
  }

  playItemDropAnimation(destroyPosition, blockType, completionHandler) {
    let autoAcquire;
    if (this.controller.getIsDirectPlayerControl() && completionHandler) {
      completionHandler();
    } else {
      autoAcquire = () => {
        const player = this.controller.levelModel.player;
        this.playItemAcquireAnimation(player.position, player.facing, sprite, completionHandler, blockType);
      };
    }
    const sprite = this.createMiniBlock(destroyPosition[0], destroyPosition[1], blockType, {onComplete: autoAcquire});

    if (sprite) {
      sprite.sortOrder = this.yToIndex(destroyPosition[1]) + 2;
    }
  }

  playScaledSpeed(animationManager, name, factor = 1) {
    var animation = animationManager.getAnimation(name);
    if (animation === null) {
      console.log("can't find animation name : " + name);
    } else {
      if (!animation.originalFps) {
        animation.originalFps = 1000 / animation.delay;
      }
      var fps = this.controller.originalFpsToScaled(animation.originalFps);
      return animationManager.play(name, fps * factor);
    }
  }

  playItemAcquireAnimation(playerPosition, facing, sprite, completionHandler, blockType) {
    const target = this.positionToScreen(playerPosition);
    const tween = this.addResettableTween(sprite).to({
      x: target.x + 20,
      y: target.y + 20,
    }, 200, Phaser.Easing.Linear.None);

    tween.onComplete.add(() => {
      const caughtUpToPlayer = Position.equals(this.player.position, playerPosition);
      if (sprite.alive && caughtUpToPlayer) {
        this.audioPlayer.play("collectedBlock");
        this.player.inventory[blockType] =
          (this.player.inventory[blockType] || 0) + 1;
        sprite.kill();
        this.toDestroy.push(sprite);
        const event = createEvent('craftCollectibleCollected');
        event.blockType = blockType;
        window.dispatchEvent(event);
        if (completionHandler) {
          completionHandler();
        }
      } else {
        this.playItemAcquireAnimation(this.player.position, this.player.facing, sprite, completionHandler, blockType);
      }
    });

    tween.start();
  }

  /**
   * Convert a grid coordinate position to a screen X/Y location.
   * @param {Array<int>} position
   * @param {?boolean} isOnBlock
   * @return {{x: number, y: number}}
   */
  positionToScreen(position, isOnBlock = false, entity = this.player) {
    const x = position[0];
    const y = position[1];
    const xOffset = entity.offset[0];
    const yOffset = entity.offset[1];
    return {
      x: xOffset + 40 * x,
      y: yOffset + (isOnBlock ? -23 : 0) + 40 * y,
    };
  }

  /**
   * @param {Position} position
   * @param {boolean} isOnBlock
   * @param {Entity} entity
   */
  setPlayerPosition(position, isOnBlock, entity = this.player) {
    const screen = this.positionToScreen(position, isOnBlock, entity);
    entity.sprite.x = screen.x;
    entity.sprite.y = screen.y;
    entity.sprite.sortOrder = this.yToIndex(screen.y) + entity.getSortOrderOffset();
  }

  setSelectionIndicatorPosition(x, y) {
    this.selectionIndicator.x = -35 + 23 + 40 * x;
    this.selectionIndicator.y = -55 + 43 + 40 * y;
  }

  /**
   * @param {Array<Array<int>>} gridSpaces An array of x and y grid coordinates.
   */
  drawHintPath(gridSpaces) {
    this.hintGroup.removeAll(true);

    const bounds = this.game.world.bounds;
    const hintPath = this.game.add.bitmapData(bounds.width, bounds.height);

    const context = hintPath.context;
    context.setLineDash([10, 10]);
    context.lineDashOffset = 5;
    context.lineWidth = 2;
    context.strokeStyle = '#fff';
    context.shadowColor = '#000';
    context.shadowOffsetY = 7;
    context.shadowBlur = 4;

    context.beginPath();
    gridSpaces.forEach(([x, y]) => {
      context.lineTo(40 * x + 19, 40 * y + 19);
    });
    context.stroke();

    const sprite = this.hintGroup.create(0, 0, hintPath);
    sprite.alpha = 0;

    this.addResettableTween(sprite)
      .to({alpha: 1}, 830, Phaser.Easing.Quadratic.Out)
      .to({alpha: 0.4}, 500, Phaser.Easing.Quadratic.InOut, true, 0, -1, true);
  }

  createGroups() {
    this.groundGroup = this.game.add.group();
    this.groundGroup.yOffset = -2;
    this.shadingGroup = this.game.add.group();
    this.shadingGroup.yOffset = -2;
    this.hintGroup = this.game.add.group();
    this.actionGroup = this.game.add.group();
    this.actionGroup.yOffset = -22;
    this.fluffGroup = this.game.add.group();
    this.fluffGroup.yOffset = -160;
    this.fowGroup = this.game.add.group();
    this.fowGroup.yOffset = 0;
  }

  resetGroups(levelData) {
    var sprite,
      x,
      y;

    this.groundGroup.removeAll(true);
    this.actionGroup.removeAll(true);
    this.hintGroup.removeAll(true);
    this.fluffGroup.removeAll(true);
    this.shadingGroup.removeAll(true);
    this.fowGroup.removeAll(true);

    this.baseShading = this.game.add.group();

    this.actionPlaneBlocks = [];
    this.refreshGroundGroup();

    for (y = 0; y < this.controller.levelModel.planeHeight; ++y) {
      for (x = 0; x < this.controller.levelModel.planeWidth; ++x) {
        let position = new Position(x, y);
        sprite = null;

        const groundBlock = levelData.groundDecorationPlane.getBlockAt(position);
        if (!groundBlock.isEmpty) {
          sprite = this.createBlock(this.actionGroup, x, y, groundBlock.blockType);
          if (sprite) {
            sprite.sortOrder = this.yToIndex(y);
          }
        }

        const actionBlock = levelData.actionPlane.getBlockAt(position);
        if (!actionBlock.shouldRenderOnGroundPlane()) {
          this.createActionPlaneBlock(position, actionBlock.blockType);
        }
      }
    }

    for (y = 0; y < this.controller.levelModel.planeHeight; ++y) {
      for (x = 0; x < this.controller.levelModel.planeWidth; ++x) {
        let position = new Position(x, y);
        if (!levelData.fluffPlane.getBlockAt(position).isEmpty) {
          sprite = this.createBlock(this.fluffGroup, x, y, levelData.fluffPlane.getBlockAt(position).blockType);
        }
      }
    }

    // We might have some default states that should be updated now that the actionPlane is set
    this.controller.levelModel.actionPlane.refreshRedstone();
    this.controller.levelModel.actionPlane.resolveConduitState();
    this.refreshActionGroup(this.controller.levelModel.actionPlane.getAllPositions());
  }

  refreshGroundGroup() {
    this.groundGroup.removeAll(true);
    for (var y = 0; y < this.controller.levelModel.planeHeight; ++y) {
      for (var x = 0; x < this.controller.levelModel.planeWidth; ++x) {
        let position = new Position(x, y);
        const groundBlock = this.controller.levelModel.groundPlane.getBlockAt(position);
        var sprite = this.createBlock(this.groundGroup, x, y, groundBlock.blockType);

        if (sprite) {
          sprite.sortOrder = this.yToIndex(y);
        }

        const actionBlock = this.controller.levelModel.actionPlane.getBlockAt(position);
        if (actionBlock && actionBlock.shouldRenderOnGroundPlane()) {
          this.createActionPlaneBlock(position, actionBlock.blockType);
        }
      }
    }
  }

  refreshActionGroup(positions) {
    // We need to add indices to refresh if there are other blocks in the action plane that might
    // conflict with the drawing of refreshed blocks.
    for (let i = 0; i < positions.length; ++i) {
      const positionBelow = Position.south(positions[i]);
      const indexIsValid = this.controller.levelModel.actionPlane.inBounds(positionBelow);
      if (indexIsValid) {
        let blockToCheck = this.controller.levelModel.actionPlane.getBlockAt(positionBelow);
        const indexIsEmpty = blockToCheck.blockType === "";
        if (!indexIsEmpty) {
          positions.push(positionBelow);
        }
      }
    }

    // Once all blocks that need to be refreshed are accounted for, go in and actually refresh.
    positions.forEach(position => {
      if (position) {
        const newBlock = this.controller.levelModel.actionPlane.getBlockAt(position);

        // we don't want to refresh doors or conduits. They're not destroyable / placeable, and
        // refreshing will lead to bad animation states
        if (newBlock && newBlock.getIsDoor()
        || newBlock && (newBlock.getIsConduit() && newBlock.isActivatedConduit)) {
          return;
        }

        if ((newBlock && newBlock.getIsMiniblock())
        || newBlock && newBlock.getIsTree()) {
          return;
        }

        if (newBlock && newBlock.blockType) {
          this.createActionPlaneBlock(position, newBlock.blockType);
        } else if (newBlock) {
          // Remove the old sprite at this position, if there is one.
          const index = this.coordinatesToIndex(position);
          this.actionGroup.remove(this.actionPlaneBlocks[index]);
          this.groundGroup.remove(this.actionPlaneBlocks[index]);
        }
      }
    });
  }

  updateShadingGroup(shadingData) {
    var index, shadowItem, sx, sy, atlas;

    this.shadingGroup.removeAll();

    this.shadingGroup.add(this.baseShading);
    if (this.selectionIndicator) {
      this.shadingGroup.add(this.selectionIndicator);
    }

    for (index = 0; index < shadingData.length; ++index) {
      shadowItem = shadingData[index];

      atlas = shadowItem.atlas;
      sx = 40 * shadowItem.x;
      sy = 40 * shadowItem.y;

      const sprite = this.shadingGroup.create(sx, sy, atlas, shadowItem.type);
      if (atlas === 'WaterAO') {
        sprite.tint = 0x555555;
      }
    }
  }

  updateFowGroup(fowData) {
    var index, fx, fy, atlas;

    this.fowGroup.removeAll();

    for (index = 0; index < fowData.length; ++index) {
      let fowItem = fowData[index];

      if (fowItem !== "") {
        atlas = "undergroundFow";
        fx = -40 + 40 * fowItem.x;
        fy = -40 + 40 * fowItem.y;

        var sprite = this.fowGroup.create(fx, fy, atlas, fowItem.type);
        sprite.alpha = 0.8;
      }
    }
  }

  playRandomPlayerIdle(facing, entity = this.player) {
    var facingName,
      rand,
      animationName;

    facingName = this.getDirectionName(facing);
    rand = Math.trunc(Math.random() * 4) + 1;

    switch (rand) {
      case 1:
        animationName = "idle";
        break;
      case 2:
        animationName = "lookLeft";
        break;
      case 3:
        animationName = "lookRight";
        break;
      case 4:
        animationName = "lookAtCam";
        break;
      default:
    }

    animationName += facingName;
    this.playScaledSpeed(entity.getAnimationManager(), animationName);
  }

  generatePlayerCelebrateFrames() {
    let frameList = [];

    //Face Down
    for (let i = 0; i < 6; ++i) {
      frameList.push("Player_001");
    }
    //Crouch Left
    frameList = frameList.concat("Player_259");
    frameList = frameList.concat("Player_260");
    //Jump
    frameList.push("Player_261");
    frameList.push("Player_297");
    frameList.push("Player_298");
    frameList.push("Player_297");
    frameList.push("Player_261");
    //Jump
    frameList.push("Player_261");
    frameList.push("Player_297");
    frameList.push("Player_298");
    frameList.push("Player_297");
    frameList.push("Player_261");
    //Pause
    frameList.push("Player_001");
    frameList.push("Player_001");
    frameList.push("Player_001");
    frameList.push("Player_001");
    frameList.push("Player_001");
    //Jump
    frameList.push("Player_261");
    frameList.push("Player_297");
    frameList.push("Player_298");
    frameList.push("Player_297");
    frameList.push("Player_261");
    //Jump
    frameList.push("Player_261");
    frameList.push("Player_297");
    frameList.push("Player_298");
    frameList.push("Player_297");
    frameList.push("Player_261");

    return frameList;
  }

  generateFramesWithEndDelay(frameName, startFrame, endFrame, endFrameFullName, buffer, frameDelay) {
    var frameList = Phaser.Animation.generateFrameNames(frameName, startFrame, endFrame, "", buffer);
    for (var i = 0; i < frameDelay; ++i) {
      frameList.push(endFrameFullName);
    }
    return frameList;
  }

  generateReverseFrames(frameName, startFrame, endFrame, suffix, buffer) {
    var frameList = Phaser.Animation.generateFrameNames(frameName, startFrame, endFrame, suffix, buffer);
    return frameList.concat(Phaser.Animation.generateFrameNames(frameName, endFrame - 1, startFrame, suffix, buffer));
  }

  preparePlayerSprite(playerName, entity = this.player) {
    entity.sprite = this.actionGroup.create(0, 0);
    entity.animationRig = this.actionGroup.create(0, 0, `player${playerName}`, 'Player_121');
    entity.sprite.addChild(entity.animationRig);

    if (this.controller.followingPlayer() && entity === this.player) {
      this.game.camera.follow(entity.sprite);
    }

    if (entity.shouldUpdateSelectionIndicator()) {
      this.selectionIndicator = this.shadingGroup.create(24, 44, 'selectionIndicator');
    }

    this.generateAnimations(FacingDirection.South, 0, entity);
    this.generateAnimations(FacingDirection.East, 60, entity);
    this.generateAnimations(FacingDirection.North, 120, entity);
    this.generateAnimations(FacingDirection.West, 180, entity);

    const frameRate = 20;
    const idleFrameRate = 10;
    let frameList;

    frameList = this.generateFramesWithEndDelay("Player_", 263, 262, "Player_262", 3, 5);
    frameList.push("Player_263");
    entity.addAnimation('lookAtCam_down', frameList, idleFrameRate, false).onComplete.add(() => {
      this.playScaledSpeed(entity.getAnimationManager(), "idlePause_down");
    });

    frameList = this.generateFramesWithEndDelay("Player_", 270, 269, "Player_269", 3, 5);
    frameList.push("Player_270");
    entity.addAnimation('lookAtCam_right', frameList, idleFrameRate, false).onComplete.add(() => {
      this.playScaledSpeed(entity.getAnimationManager(), "idlePause_right");
    });

    frameList = this.generateFramesWithEndDelay("Player_", 277, 276, "Player_276", 3, 5);
    frameList.push("Player_277");
    entity.addAnimation('lookAtCam_up', frameList, idleFrameRate, false).onComplete.add(() => {
      this.playScaledSpeed(entity.getAnimationManager(), "idlePause_up");
    });

    frameList = this.generateFramesWithEndDelay("Player_", 284, 283, "Player_283", 3, 5);
    frameList.push("Player_284");
    entity.addAnimation('lookAtCam_left', frameList, idleFrameRate, false).onComplete.add(() => {
      this.playScaledSpeed(entity.getAnimationManager(), "idlePause_left");
    });

    entity.addAnimation('mine_down', Phaser.Animation.generateFrameNames("Player_", 241, 244, "", 3), frameRate, true);
    entity.addAnimation('mine_right', Phaser.Animation.generateFrameNames("Player_", 245, 248, "", 3), frameRate, true);
    entity.addAnimation('mine_up', Phaser.Animation.generateFrameNames("Player_", 249, 252, "", 3), frameRate, true);
    entity.addAnimation('mine_left', Phaser.Animation.generateFrameNames("Player_", 253, 256, "", 3), frameRate, true);

    entity.addAnimation('mineCart_down', Phaser.Animation.generateFrameNames("Minecart_", 5, 5, "", 2), frameRate, false);
    entity.addAnimation('mineCart_turnleft_down', Phaser.Animation.generateFrameNames("Minecart_", 6, 6, "", 2), frameRate, false);
    entity.addAnimation('mineCart_turnright_down', Phaser.Animation.generateFrameNames("Minecart_", 12, 12, "", 2), frameRate, false);

    entity.addAnimation('mineCart_right', Phaser.Animation.generateFrameNames("Minecart_", 7, 7, "", 2), frameRate, false);
    entity.addAnimation('mineCart_left', Phaser.Animation.generateFrameNames("Minecart_", 11, 11, "", 2), frameRate, false);

    entity.addAnimation('mineCart_up', Phaser.Animation.generateFrameNames("Minecart_", 9, 9, "", 2), frameRate, false);
    entity.addAnimation('mineCart_turnleft_up', Phaser.Animation.generateFrameNames("Minecart_", 10, 10, "", 2), frameRate, false);
    entity.addAnimation('mineCart_turnright_up', Phaser.Animation.generateFrameNames("Minecart_", 8, 8, "", 2), frameRate, false);

    if (this.controller.levelModel.isUnderwater()) {
      let frameRate = 10;

      for (let [direction, offset] of [["down", 299], ["left", 306], ["up", 313], ["right", 320]]) {
        entity.addAnimation("walk_" + direction, Phaser.Animation.generateFrameNames("Player_", offset + 1, offset + 4, "", 3), frameRate / 2, true);
      }

      for (let [direction, offset] of [["down", 327], ["left", 333], ["up", 345], ["right", 339]]) {
        entity.addAnimation("bump_" + direction, Phaser.Animation.generateFrameNames("Player_", offset, offset + 5, "", 3), frameRate, false).onStart.add(() => {
          this.audioPlayer.play("bump");
        });
      }

      for (let [direction, offset] of [["down", 351], ["left", 354], ["up", 360], ["right", 357]]) {
        const singlePunch = Phaser.Animation.generateFrameNames("Player_", offset, offset + 2, "", 3);
        entity.addAnimation("punch_" + direction, singlePunch, frameRate, false).onComplete.add(() => {
          this.audioPlayer.play("punch");
        });

        entity.addAnimation("punchDestroy_" + direction, singlePunch.concat(singlePunch).concat(singlePunch), frameRate, false);
      }
    }

    if (this.controller.levelModel.isInBoat()) {
      let frameRate = 10;
      for (let [direction, offset] of [["down", 9], ["left", 15], ["up", 21], ["right", 27]]) {
        entity.addAnimation("idle_" + direction, Phaser.Animation.generateFrameNames("Boat_", offset, offset, "", 2), frameRate, true);
        entity.addAnimation("walk_" + direction, Phaser.Animation.generateFrameNames("Boat_", offset, offset + 4, "", 2), frameRate, true);
        entity.addAnimation("celebrate_" + direction, ["Boat_49", "Boat_50", "Boat_49", "Boat_50", "Boat_49"], frameRate / 2, false);
      }

      for (let [direction, offset] of [["down", 51], ["left", 63], ["up", 69], ["right", 57]]) {
        entity.addAnimation("bump_" + direction, Phaser.Animation.generateFrameNames("Boat_", offset, offset + 5, "", 2), frameRate, false).onStart.add(() => {
          this.audioPlayer.play("bump");
        });
      }

      // Boat bobs up and down
      Boat.addBobTween(this.game, entity.animationRig);
    }
  }

  playerFrameName(n) {
    return Phaser.Animation.generateFrameNames("Player_", n, n, "", 3);
  }

  /**
   * Create action animations for Alex, Steve and the Agent from the sprite
   * sheet and JSON map.
   * @param {FacingDirection} facing
   * @param {int} offset
   */
  generateAnimations(facing, offset, entity = this.player) {
    const direction = this.getDirectionName(facing);
    const idleFrameRate = 10;
    let frameRate = 20;

    let frameList = [];

    frameList.push(this.playerFrameName(offset + 1));
    frameList.push(this.playerFrameName(offset + 3));
    frameList.push(this.playerFrameName(offset + 1));
    frameList.push(this.playerFrameName(offset + 7));
    frameList.push(this.playerFrameName(offset + 9));
    frameList.push(this.playerFrameName(offset + 7));
    for (let i = 0; i < 5; ++i) {
      frameList.push(this.playerFrameName(offset + 1));
    }

    entity.addAnimation('idle' + direction, frameList, frameRate / 3, false).onComplete.add(() => {
      this.playRandomPlayerIdle(facing, entity);
    });
    frameList = this.generateFramesWithEndDelay("Player_", offset + 6, offset + 5, this.playerFrameName(offset + 5), 3, 5);
    frameList.push(this.playerFrameName(offset + 6));
    entity.addAnimation('lookLeft' + direction, frameList, idleFrameRate, false).onComplete.add(() => {
      this.playScaledSpeed(entity.getAnimationManager(), "idlePause" + direction);
    });
    frameList = this.generateFramesWithEndDelay("Player_", offset + 12, offset + 11, this.playerFrameName(offset + 11), 3, 5);
    frameList.push(this.playerFrameName(offset + 12));
    entity.addAnimation('lookRight' + direction, frameList, idleFrameRate, false).onComplete.add(() => {
      this.playScaledSpeed(entity.getAnimationManager(), "idlePause" + direction);
    });
    frameList = [];
    for (let i = 0; i < 13; ++i) {
      frameList.push(this.playerFrameName(offset + 1));
    }
    entity.addAnimation('idlePause' + direction, frameList, frameRate / 3, false).onComplete.add(() => {
      this.playRandomPlayerIdle(facing, entity);
    });

    entity.addAnimation('walk' + direction, Phaser.Animation.generateFrameNames("Player_", offset + 13, offset + 20, "", 3), frameRate, true);
    let singlePunch = Phaser.Animation.generateFrameNames("Player_", offset + 21, offset + 24, "", 3);
    entity.addAnimation('punch' + direction, singlePunch, frameRate, false).onComplete.add(() => {
      this.audioPlayer.play("punch");
    });
    entity.addAnimation('punchDestroy' + direction, singlePunch.concat(singlePunch).concat(singlePunch), frameRate, false);
    entity.addAnimation('hurt' + direction, Phaser.Animation.generateFrameNames("Player_", offset + 25, offset + 28, "", 3), frameRate, false).onComplete.add(() => {
      this.playScaledSpeed(entity.getAnimationManager(), "idlePause" + direction);
    });
    entity.addAnimation('crouch' + direction, Phaser.Animation.generateFrameNames("Player_", offset + 29, offset + 32, "", 3), frameRate, true);
    entity.addAnimation('jumpUp' + direction, Phaser.Animation.generateFrameNames("Player_", offset + 33, offset + 36, "", 3), frameRate / 2, true);
    entity.addAnimation('fail' + direction, Phaser.Animation.generateFrameNames("Player_", offset + 45, offset + 48, "", 3), frameRate, false);
    entity.addAnimation('celebrate' + direction, this.generatePlayerCelebrateFrames(), frameRate / 2, false);
    entity.addAnimation('bump' + direction, Phaser.Animation.generateFrameNames("Player_", offset + 49, offset + 54, "", 3), frameRate, false).onStart.add(() => {
      this.audioPlayer.play("bump");
    });
    entity.addAnimation('jumpDown' + direction, Phaser.Animation.generateFrameNames("Player_", offset + 55, offset + 60, "", 3), frameRate, true);
  }

  /**
   * Create a "miniblock" asset (representing a floating collectable) based on
   * the given block at the given coordinates
   *
   * @param {Number} x
   * @param {Number} y
   * @param {String} blockType
   * @param {Object} [overrides] optional overrides for various defaults
   * @param {Number} [overrides.collectibleDistance=2] distance at which the
   *        miniblock can be collected
   * @param {Number} [overrides.xOffsetRange=40]
   * @param {Number} [overrides.yOffsetRange=40]
   */
  createMiniBlock(x, y, blockType, overrides = {}) {
    function valueOr(value, defaultValue) {
      if (value === undefined) {
        return defaultValue;
      }
      return value;
    }

    let collectibleDistance = valueOr(overrides.collectibleDistance, 2);
    const xOffsetRange = valueOr(overrides.xOffsetRange, 40);
    const yOffsetRange = valueOr(overrides.yOffsetRange, 40);

    const frame = LevelBlock.getMiniblockFrame(blockType);
    if (!(frame && this.miniBlocks[frame])) {
      return null;
    }

    const atlas = "miniBlocks";
    const xOffset = 7 - (xOffsetRange / 2) + (Math.random() * xOffsetRange);
    const yOffset = 3 - (yOffsetRange / 2) + (Math.random() * yOffsetRange);
    const offset = new Position(xOffset, yOffset);

    const layer = overrides.isOnBlock ? -20 : 0;
    const sprite = this.actionGroup.create(xOffset + 40 * x, yOffset + 40 * y + layer, atlas, "shadow.png");
    const item = this.actionGroup.create(0, 0, atlas, this.miniBlocks[frame] + ".png");
    sprite.addChild(item);

    const bounce = k => {
      if (k < 0.2) {
        return 1;
      } else if (k < 0.4) {
        return 2;
      } else if (k < 0.6) {
        return 1;
      } else if (k < 0.8) {
        return 0;
      } else if (k < 1) {
        return 1;
      } else {
        return 0;
      }
    };
    const tween = this.addResettableTween(item).to({y: -8}, 350, bounce);

    if (overrides.onComplete) {
      // Player will auto-acquire the dropped miniblock before moving on.
      tween.onComplete.add(overrides.onComplete);
    } else {
      // If not auto-acquiring, add the miniblock to the list of collectible items.
      const distanceBetween = function (position, position2) {
        return Math.sqrt(Math.pow(position.x - position2.x, 2) + Math.pow(position.y - position2.y, 2));
      };

      const collectiblePosition = this.controller.levelModel.spritePositionToIndex(offset, new Position(sprite.x, sprite.y));

      this.collectibleItems.push([sprite, offset, blockType, collectibleDistance]);
      tween.onComplete.add(() => {
        if (this.controller.levelModel.usePlayer) {
          if (distanceBetween(this.player.position, collectiblePosition) < collectibleDistance) {
            this.player.collectItems(new Position(x, y));
          }
        }
      });
    }

    tween.start();
    return sprite;
  }

  playAnimationWithRandomOffset(animations, animationName) {
    const animation = this.playScaledSpeed(animations, animationName);
    // Randomize the starting frame, so that not all bubbles/lavaPops are synchronized.
    animation.frame = Math.trunc(Math.random() * animation.frameTotal);
  }

  psuedoRandomTint(group, sprite, x, y) {
    const psuedoRandom = Math.pow((x * 10) + y, 5) % 251;
    let darkness = psuedoRandom / 12;
    if (group === this.groundGroup) {
      darkness += 24;
    } else {
      darkness *= 0.75;
    }
    const brightness = Math.floor(0xff - darkness).toString(16);
    sprite.tint = '0x' + brightness + brightness + brightness;
  }

  createBlock(group, x, y, blockType) {
    const position = new Position(x, y);

    var i,
      sprite = null,
      frameList,
      atlas,
      frame,
      xOffset,
      yOffset;


    var buildTree = function (levelView, frame) {
      let type = blockType.substring(4);
      sprite = levelView.createBlock(group, x, y, "log" + type);
      sprite.fluff = levelView.createBlock(levelView.fluffGroup, x, y, "leaves" + type);
      sprite.onBlockDestroy = (logSprite) => {
        logSprite.fluff.animations.add("despawn", Phaser.Animation.generateFrameNames("Leaves_" + type, frame[0], frame[1], ".png", 0), 10, false).onComplete.add(() => {
          levelView.toDestroy.push(logSprite.fluff);
          logSprite.fluff.kill();
        });

        levelView.playScaledSpeed(logSprite.fluff.animations, "despawn");
      };
      levelView.trees.push({ sprite: sprite, type: blockType, position: position });
    };

    const buildDoor = (levelView, type) => {
      atlas = this.blocks[blockType][0];
      frame = this.blocks[blockType][1];
      xOffset = this.blocks[blockType][2];
      yOffset = this.blocks[blockType][3];
      sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);

      frameList = [];
      var animationFramesIron = Phaser.Animation.generateFrameNames(type, 0, 3, "", 1);
      for (let j = 0; j < 5; ++j) {
        frameList.push(`${type}0`);
      }
      frameList = frameList.concat(animationFramesIron);
      sprite.animations.add("open", frameList);

      frameList = [];
      animationFramesIron = Phaser.Animation.generateFrameNames(type, 3, 0, "", 1);
      for (let j = 0; j < 5; ++j) {
        frameList.push(`${type}3`);
      }
      frameList = frameList.concat(animationFramesIron);
      sprite.animations.add("close", frameList);

      return sprite;
    };

    switch (blockType) {
      case "treeAcacia": //0,7
        buildTree(this, [0, 7]);
        break;
      case "treeBirch":  //0,8
        buildTree(this, [0, 8]);
        break;
      case "treeJungle": //0,9
        buildTree(this, [0, 9]);
        break;
      case "treeOak":
        buildTree(this, [0, 6]);
        break;
      case "treeSpruce": //0,8
        buildTree(this, [0, 8]);
        break;
      case "treeSpruceSnowy": //1,9
        buildTree(this, [0, 8]);
        break;
      case "cropWheat":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Wheat", 0, 2, "", 0);
        sprite.animations.add("idle", frameList, 0.4, false);
        this.playScaledSpeed(sprite.animations, "idle");
        break;

      case "torch":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Torch", 0, 23, "", 0);
        sprite.animations.add("idle", frameList, 15, true);
        this.playScaledSpeed(sprite.animations, "idle");
        break;

      case "water":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Water_", 0, 5, "", 0);
        sprite.animations.add("idle", frameList, 5, true);
        this.playScaledSpeed(sprite.animations, "idle");
        break;

      //for placing wetland for crops in free play
      case "watering":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        sprite.kill();
        this.toDestroy.push(sprite);
        this.createBlock(this.groundGroup, x, y, "farmlandWet");
        this.refreshGroundGroup();
        break;

      case "lava":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Lava_", 0, 5, "", 0);
        sprite.animations.add("idle", frameList, 5, true);
        this.playScaledSpeed(sprite.animations, "idle");
        break;

      case "magmaBlock":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Magma_Block", 0, 5, "", 0);
        sprite.animations.add("idle", frameList, 5, true);
        this.playScaledSpeed(sprite.animations, "idle");
        break;

      case "magmaUnderwater":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Magma_Bubble_Boat", 0, 5, "", 0);

        sprite.animations.add("idle", frameList, 5, true);
        this.playAnimationWithRandomOffset(sprite.animations, "idle");
        break;

      case "magmaDeep":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Magma_Bubble_Deep", 0, 5, "", 0);
        sprite.animations.add("idle", frameList, 5, true);
        this.playAnimationWithRandomOffset(sprite.animations, "idle");
        break;

      case "bubbleColumn":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Bubble_Column", 0, 5, "", 0);
        sprite.animations.add("idle", frameList, 5, true);
        this.playAnimationWithRandomOffset(sprite.animations, "idle");
        break;

      case "conduit":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);

        frameList = Phaser.Animation.generateFrameNames("Conduit", 3, 10, "", 2);
        sprite.animations.add("open", frameList, 5, true);

        frameList = Phaser.Animation.generateFrameNames("Conduit", 0, 2, "", 2);
        sprite.animations.add("activation", frameList, 5, false);
        sprite.animations.add("deactivation", frameList.reverse(), 5, false);

        break;

      case "prismarine":
        this.initPrismarine();
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, this.prismarine);
        break;

      case "seaLantern":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Sea_Lantern", 0, 4, "", 0);
        sprite.animations.add("idle", frameList, 5, true);
        this.playScaledSpeed(sprite.animations, "idle");
        break;

      case "seaGrass":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Seagrass", 0, 5, "", 0);
        sprite.animations.add("idle", frameList, 5, true);
        this.playScaledSpeed(sprite.animations, "idle", 0.5);
        break;

      case "kelp":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("KelpSingle_", 0, 5, "", 0);
        sprite.animations.add("idle", frameList, 5, true);
        this.playScaledSpeed(sprite.animations, "idle", 0.5);
        break;

      case "Chest":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Chest", 0, 2, "", 0);
        sprite.animations.add("open", frameList, 5, false);
        break;

      case "NetherPortal":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("NetherPortal", 1, 6, "", 0);
        sprite.animations.add("idle", frameList, 5, true);
        this.playScaledSpeed(sprite.animations, "idle");
        break;

      case "lavaPop":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("LavaPop", 1, 7, "", 2);
        for (i = 0; i < 4; ++i) {
          frameList.push("LavaPop07");
        }
        frameList = frameList.concat(Phaser.Animation.generateFrameNames("LavaPop", 8, 13, "", 2));
        for (i = 0; i < 3; ++i) {
          frameList.push("LavaPop13");
        }
        frameList = frameList.concat(Phaser.Animation.generateFrameNames("LavaPop", 14, 30, "", 2));
        for (i = 0; i < 8; ++i) {
          frameList.push("LavaPop01");
        }
        sprite.animations.add("idle", frameList, 5, true);
        this.playAnimationWithRandomOffset(sprite.animations, "idle");
        break;

      case "fire":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Fire", 0, 14, "", 2);
        sprite.animations.add("idle", frameList, 5, true);
        this.playScaledSpeed(sprite.animations, "idle");
        break;

      case "bubbles":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Bubbles", 0, 14, "", 2);
        sprite.animations.add("idle", frameList, 5, true);
        this.playScaledSpeed(sprite.animations, "idle");
        break;

      case "explosion":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("Explosion", 0, 16, "", 1);
        sprite.animations.add("idle", frameList, 15, false).onComplete.add(() => {
          this.toDestroy.push(sprite);
          sprite.kill();
        });
        this.playScaledSpeed(sprite.animations, "idle");
        break;

      case "door":
        sprite = buildDoor(this, "Door");
        break;

      case "doorIron":
        sprite = buildDoor(this, "DoorIron");
        if (this.blockReceivesCornerShadow(x, y)) {
          sprite.addChild(this.game.make.sprite(-40, 55, "blockShadows", "Shadow_Parts_Fade_overlap.png"));
        }
        break;

      case "tnt":
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        frameList = Phaser.Animation.generateFrameNames("TNTexplosion", 0, 8, "", 0);
        sprite.animations.add("explode", frameList, 7, false).onComplete.add(() => {
          this.playExplosionCloudAnimation(position);
          sprite.kill();
          this.toDestroy.push(sprite);
          this.actionPlaneBlocks[this.coordinatesToIndex(position)] = null;
        });
        break;

      default:
        if (!this.blocks[blockType]) {
          throw new Error(`Unknown block type: ${blockType}`);
        }
        atlas = this.blocks[blockType][0];
        frame = this.blocks[blockType][1];
        xOffset = this.blocks[blockType][2];
        yOffset = this.blocks[blockType][3];
        sprite = group.create(xOffset + 40 * x, yOffset + group.yOffset + 40 * y, atlas, frame);
        if (group === this.actionGroup || group === this.groundGroup) {
          if (!LevelBlock.isWalkable(blockType)) {
            this.psuedoRandomTint(group, sprite, x, y);
          }
        }
        if (group === this.actionGroup && !LevelBlock.isWalkable(blockType) && this.blockReceivesCornerShadow(x, y)) {
          let xShadow = -39;
          let yShadow = 40;
          if (blockType.startsWith("pistonArm")) {
            xShadow = -26;
            yShadow = 53;
          }
          sprite.addChild(this.game.make.sprite(xShadow, yShadow, "blockShadows", "Shadow_Parts_Fade_overlap.png"));
        }
        if (blockType.startsWith('redstoneWire') && blockType.endsWith('On')) {
          sprite.addChild(this.addRedstoneSparkle());
        }
        break;
    }

    return sprite;
  }

  addRedstoneSparkle() {
    const blank = "redstone_sparkle99.png";
    const sprite = this.game.make.sprite(20, 25, "redstoneSparkle", blank);

    // Establish the three different animations.
    for (let i = 0; i < 3; i++) {
      const n = i * 8;
      const frames = [blank].concat(Phaser.Animation.generateFrameNames("redstone_sparkle", n, n + 7, ".png"), blank);
      sprite.animations.add(`fizz_${i}`, frames, 7);
    }

    const playRandomSparkle = () => {
      setTimeout(() => {
        if (!sprite.alive) {
          return;
        }

        // Pick one of the animations to play.
        let whichAnim = Math.floor(Math.random() * 3);
        this.onAnimationEnd(this.playScaledSpeed(sprite.animations, `fizz_${whichAnim}`), playRandomSparkle);

        // Randomize which corner of the index the animation manifests in.
        sprite.position.x = (Math.random() > 0.5) ? 20 : 40;
        sprite.position.y = (Math.random() > 0.5) ? 25 : 45;
      }, randomInt(500, 7000) / this.controller.tweenTimeScale);
    };

    playRandomSparkle();

    return sprite;
  }

  blockReceivesCornerShadow(x, y) {
    const southBlock = this.controller.levelModel.actionPlane.getBlockAt([x, y + 1]);
    if (!southBlock || (southBlock.blockType && !southBlock.isWalkable)) {
      return false;
    }

    const southWestBlock = this.controller.levelModel.actionPlane.getBlockAt([x - 1, y + 1]);
    return southWestBlock && southWestBlock.blockType && !southWestBlock.isWalkable;
  }

  isUnderTree(treeIndex, position) {
    // invalid index
    if (treeIndex >= this.trees.length || treeIndex < 0) {
      return false;
    }
    var fluffPositions = this.treeFluffTypes[this.trees[treeIndex].type];
    for (var i = 0; i < fluffPositions.length; i++) {
      if (this.trees[treeIndex].position[0] + fluffPositions[i][0] === position[0] && this.trees[treeIndex].position[1] + fluffPositions[i][1] === position[1]) {
        return true;
      }
    }
    return false;
  }

  changeTreeAlpha(treeIndex, alpha) {
    var tween = this.controller.levelView.addResettableTween(this.trees[treeIndex].sprite.fluff).to({
      alpha: alpha
    }, 300, Phaser.Easing.Linear.None);

    tween.start();
  }

  onAnimationEnd(animation, completionHandler) {
    var signalBinding = animation.onComplete.add(() => {
      signalBinding.detach();
      completionHandler();
    });
  }

  onAnimationStart(animation, completionHandler) {
    var signalBinding = animation.onStart.add(() => {
      signalBinding.detach();
      completionHandler();
    });
  }

  onAnimationLoopOnce(animation, completionHandler) {
    var signalBinding = animation.onLoop.add(() => {
      signalBinding.detach();
      completionHandler();
    });
  }

  addResettableTween(sprite) {
    var tween = this.game.add.tween(sprite);
    tween.timeScale = this.controller.tweenTimeScale;
    this.resettableTweens.push(tween);
    return tween;
  }

  /**
  * Animate Door and set the status
  */
  animateDoor(index, open) {
    let player = this.controller.levelModel.player;
    this.setSelectionIndicatorPosition(this.controller.levelModel.actionPlane.indexToCoordinates(index)[0], this.controller.levelModel.actionPlane.indexToCoordinates(index)[1]);
    this.controller.audioPlayer.play("doorOpen");
    // If it's not walable, then open otherwise, close.
    const position = this.controller.levelModel.actionPlane.indexToCoordinates(index);
    this.playDoorAnimation(position, open, () => {
      const block = this.controller.levelModel.actionPlane.getBlockAt(position);
      block.isWalkable = block.isOpen;
      if (block.blockType !== "doorIron") {
        // Iron doors don't need to set the player animation to Idle, because they're not opened with 'use'.
        this.playIdleAnimation(player.position, player.facing, player.isOnBlock, player);
      }
      this.setSelectionIndicatorPosition(player.position[0], player.position[1]);
    });
  }

};
var GAME_WIDTH = 400;
var GAME_HEIGHT = 400;

/**
 * Initializes a new instance of a mini-game visualization
 */
class GameController {
  /**
   * @param {Object} gameControllerConfig
   * @param {String} gameControllerConfig.containerId DOM ID to mount this app
   * @param {Phaser} gameControllerConfig.Phaser Phaser package
   * @constructor
   */
  constructor(gameControllerConfig) {
    this.DEBUG = gameControllerConfig.debug;

    // Phaser pre-initialization config
    window.PhaserGlobal = {
      disableAudio: true,
      disableWebAudio: true,
      hideBanner: !this.DEBUG
    };

    /**
     * @public {Object} codeOrgAPI - API with externally-callable methods for
     * starting an attempt, issuing commands, etc.
     */
    this.codeOrgAPI = getCodeOrgAPI(this);

    var Phaser = gameControllerConfig.Phaser;

    /**
     * Main Phaser game instance.
     * @property {Phaser.Game}
     */
    this.game = new Phaser.Game({
      forceSetTimeOut: gameControllerConfig.forceSetTimeOut,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      renderer: Phaser.AUTO,
      parent: gameControllerConfig.containerId,
      state: 'earlyLoad',
      // TODO(bjordan): remove now that using canvas?
      preserveDrawingBuffer: true // enables saving .png screengrabs
    });

    this.specialLevelType = null;
    this.queue = new CommandQueue(this);
    this.OnCompleteCallback = null;

    this.assetRoot = gameControllerConfig.assetRoot;

    this.audioPlayer = gameControllerConfig.audioPlayer;
    this.afterAssetsLoaded = gameControllerConfig.afterAssetsLoaded;
    this.assetLoader = new AssetLoader(this);
    this.earlyLoadAssetPacks =
      gameControllerConfig.earlyLoadAssetPacks || [];
    this.earlyLoadNiceToHaveAssetPacks =
      gameControllerConfig.earlyLoadNiceToHaveAssetPacks || [];

    this.resettableTimers = [];
    this.timeouts = [];
    this.timeout = 0;
    this.initializeCommandRecord();

    this.score = 0;
    this.useScore = false;
    this.scoreText = null;
    this.onScoreUpdate = gameControllerConfig.onScoreUpdate;

    this.events = [];

    // Phaser "slow motion" modifier we originally tuned animations using
    this.assumedSlowMotion = 1.5;
    this.initialSlowMotion = gameControllerConfig.customSlowMotion || this.assumedSlowMotion;
    this.tweenTimeScale = 1.5 / this.initialSlowMotion;

    this.playerDelayFactor = 1.0;
    this.dayNightCycle = false;
    this.player = null;
    this.agent = null;

    this.timerSprite = null;

    this.game.state.add('earlyLoad', {
      preload: () => {
        // don't let state change stomp essential asset downloads in progress
        this.game.load.resetLocked = true;
        this.assetLoader.loadPacks(this.earlyLoadAssetPacks);
      },
      create: () => {
        // optionally load some more assets if we complete early load before level load
        this.assetLoader.loadPacks(this.earlyLoadNiceToHaveAssetPacks);
        this.game.load.start();
      }
    });

    this.game.state.add('levelRunner', {
      preload: this.preload.bind(this),
      create: this.create.bind(this),
      update: this.update.bind(this),
      render: this.render.bind(this)
    });
  }

  /**
   * Is this one of those level types in which the player is controlled by arrow
   * keys rather than by blocks?
   *
   * @return {boolean}
   */
  getIsDirectPlayerControl() {
    return this.levelData.isEventLevel || this.levelData.isAgentLevel;
  }

  /**
   * @param {Object} levelConfig
   */
  loadLevel(levelConfig) {
    this.levelData = Object.freeze(levelConfig);

    this.levelEntity = new LevelEntity(this);
    this.levelModel = new LevelModel(this.levelData, this);
    this.levelView = new LevelView(this);
    this.specialLevelType = levelConfig.specialLevelType;
    this.timeout = levelConfig.levelVerificationTimeout;
    if (levelConfig.useScore !== undefined) {
      this.useScore = levelConfig.useScore;
    }
    this.timeoutResult = levelConfig.timeoutResult;
    this.onDayCallback = levelConfig.onDayCallback;
    this.onNightCallback = levelConfig.onNightCallback;

    this.game.state.start('levelRunner');
  }

  reset() {
    this.dayNightCycle = false;
    this.queue.reset();
    this.levelEntity.reset();
    this.levelModel.reset();
    this.levelView.reset(this.levelModel);
    this.levelEntity.loadData(this.levelData);
    this.player = this.levelModel.player;
    this.agent = this.levelModel.agent;
    this.resettableTimers.forEach((timer) => {
      timer.stop(true);
    });
    this.timeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    if (this.timerSprite) {
      this.timerSprite.kill();
    }
    this.timerSprite = null;
    this.timeouts = [];
    this.resettableTimers.length = 0;
    this.events.length = 0;

    this.score = 0;
    if (this.useScore) {
      this.updateScore();
    }

    if (!this.getIsDirectPlayerControl()) {
      this.events.push(event => {
        if (event.eventType === EventType.WhenUsed && event.targetType === 'sheep') {
          this.codeOrgAPI.drop(null, 'wool', event.targetIdentifier);
        }
        if (event.eventType === EventType.WhenTouched && event.targetType === 'creeper') {
          this.codeOrgAPI.flashEntity(null, event.targetIdentifier);
          this.codeOrgAPI.explodeEntity(null, event.targetIdentifier);
        }
      });
    }

    this.initializeCommandRecord();
  }

  preload() {
    this.game.load.resetLocked = true;
    this.game.time.advancedTiming = this.DEBUG;
    this.game.stage.disableVisibilityChange = true;
    this.assetLoader.loadPacks(this.levelData.assetPacks.beforeLoad);
  }

  create() {
    this.levelView.create(this.levelModel);
    this.game.time.slowMotion = this.initialSlowMotion;
    this.addCheatKeys();
    this.assetLoader.loadPacks(this.levelData.assetPacks.afterLoad);
    this.game.load.image('timer', `${this.assetRoot}images/placeholderTimer.png`);
    this.game.load.onLoadComplete.addOnce(() => {
      if (this.afterAssetsLoaded) {
        this.afterAssetsLoaded();
      }
    });
    this.levelEntity.loadData(this.levelData);
    this.game.load.start();
  }

  run() {
    // dispatch when spawn event at run
    this.events.forEach(e => e({ eventType: EventType.WhenRun, targetIdentifier: undefined }));
    for (var value of this.levelEntity.entityMap) {
      var entity = value[1];
      this.events.forEach(e => e({ eventType: EventType.WhenSpawned, targetType: entity.type, targetIdentifier: entity.identifier }));
      entity.queue.begin();
    }
    // set timeout for timeout
    const isNumber = !isNaN(this.timeout);
    if (isNumber && this.timeout > 0) {
      this.timerSprite = this.game.add.sprite(-50, 390, 'timer');
      var tween = this.levelView.addResettableTween(this.timerSprite).to({
        x: -450, alpha: 0.5
      }, this.timeout, Phaser.Easing.Linear.None);

      tween.onComplete.add(() => {
        this.endLevel(this.timeoutResult(this.levelModel));
      });

      tween.start();
    }
  }

  followingPlayer() {
    return !!this.levelData.gridDimensions && !this.checkMinecartLevelEndAnimation();
  }

  update() {
    this.queue.tick();
    this.levelEntity.tick();
    if (this.levelModel.usePlayer) {
      this.player.updateMovement();
    }
    if (this.levelModel.usingAgent) {
      this.agent.updateMovement();
    }
    this.levelView.update();

    // Check for completion every frame for "event" levels. For procedural
    // levels, only check completion after the player has run all commands.
    if (this.getIsDirectPlayerControl() || this.player.queue.state > 1) {
      this.checkSolution();
    }
  }

  addCheatKeys() {
    if (!this.levelModel.usePlayer) {
      return;
    }

    const keysToMovementState = {
      [Phaser.Keyboard.W]: FacingDirection.North,
      [Phaser.Keyboard.D]: FacingDirection.East,
      [Phaser.Keyboard.S]: FacingDirection.South,
      [Phaser.Keyboard.A]: FacingDirection.West,
      [Phaser.Keyboard.SPACEBAR]: -2
    };

    const editableElementSelected = function () {
      const editableHtmlTags = ["INPUT", "TEXTAREA"];
      return document.activeElement !== null &&
             editableHtmlTags.includes(document.activeElement.tagName);
    };

    Object.keys(keysToMovementState).forEach((key) => {
      const movementState = keysToMovementState[key];
      this.game.input.keyboard.addKey(key).onDown.add(() => {
        if (editableElementSelected()) {
          return;
        }
        this.player.movementState = movementState;
        this.player.updateMovement();
      });
      this.game.input.keyboard.addKey(key).onUp.add(() => {
        if (editableElementSelected()) {
          return;
        }
        if (this.player.movementState === movementState) {
          this.player.movementState = -1;
        }
        this.player.updateMovement();
      });
      this.game.input.keyboard.removeKeyCapture(key);
    });
  }

  handleEndState(result) {
    // report back to the code.org side the pass/fail result
    //     then clear the callback so we dont keep calling it
    if (this.OnCompleteCallback) {
      this.OnCompleteCallback(result, this.levelModel);
      this.OnCompleteCallback = null;
    }
  }

  render() {
    if (this.DEBUG) {
      this.game.debug.text(this.game.time.fps || '--', 2, 14, "#00ff00");
    }
    this.levelView.render();
  }

  scaleFromOriginal() {
    var [newWidth, newHeight] = this.levelData.gridDimensions || [10, 10];
    var [originalWidth, originalHeight] = [10, 10];
    return [newWidth / originalWidth, newHeight / originalHeight];
  }

  getScreenshot() {
    return this.game.canvas.toDataURL("image/png");
  }

  // command record

  initializeCommandRecord() {
    let commandList = ["moveAway", "moveToward", "moveForward", "turn", "turnRandom", "explode", "wait", "flash", "drop", "spawn", "destroy", "playSound", "attack", "addScore"];
    this.commandRecord = new Map;
    this.repeatCommandRecord = new Map;
    this.isRepeat = false;
    for (var i = 0; i < commandList.length; i++) {
      this.commandRecord.set(commandList[i], new Map);
      this.commandRecord.get(commandList[i]).set("count", 0);
      this.repeatCommandRecord.set(commandList[i], new Map);
      this.repeatCommandRecord.get(commandList[i]).set("count", 0);
    }
  }

  startPushRepeatCommand() {
    this.isRepeat = true;
  }

  endPushRepeatCommand() {
    this.isRepeat = false;
  }

  addCommandRecord(commandName, targetType, repeat) {
    var commandRecord = repeat ? this.repeatCommandRecord : this.commandRecord;
    // correct command name
    if (commandRecord.has(commandName)) {
      // update count for command map
      let commandMap = commandRecord.get(commandName);
      commandMap.set("count", commandMap.get("count") + 1);
      // command map has target
      if (commandMap.has(targetType)) {
        // increment count
        commandMap.set(targetType, commandMap.get(targetType) + 1);
      } else {
        commandMap.set(targetType, 1);
      }
      if (this.DEBUG) {
        const msgHeader = repeat ? "Repeat " : "" + "Command :";
        console.log(msgHeader + commandName + " executed in mob type : " + targetType + " updated count : " + commandMap.get(targetType));
      }
    }
  }

  getCommandCount(commandName, targetType, repeat) {
    var commandRecord = repeat ? this.repeatCommandRecord : this.commandRecord;
    // command record has command name and target
    if (commandRecord.has(commandName)) {
      let commandMap = commandRecord.get(commandName);
      // doesn't have target so returns global count for command
      if (targetType === undefined) {
        return commandMap.get("count");
        // type specific count
      } else if (commandMap.has(targetType)) {
        return commandMap.get(targetType);
        // doesn't have a target
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  }

  // command processors

  getEntity(target) {
    if (target === undefined) {
      target = 'Player';
    }
    let entity = this.levelEntity.entityMap.get(target);
    if (entity === undefined) {
      console.log("Debug GetEntity: there is no entity : " + target + "\n");
    }
    return entity;
  }

  getEntities(type) {
    return this.levelEntity.getEntitiesOfType(type);
  }

  isType(target) {
    return typeof (target) === 'string' && (target !== 'Player' && target !== "PlayerAgent");
  }

  printErrorMsg(msg) {
    if (this.DEBUG) {
      this.game.debug.text(msg);
    }
  }

  /**
   * @param {any} commandQueueItem
   * @param {any} moveAwayFrom (entity identifier)
   *
   * @memberOf GameController
   */
  moveAway(commandQueueItem, moveAwayFrom) {
    var target = commandQueueItem.target;
    // apply to all entities
    if (target === undefined) {
      var entities = this.levelEntity.entityMap;
      for (var value of entities) {
        let entity = value[1];
        let callbackCommand = new CallbackCommand(this, () => { }, () => { this.moveAway(callbackCommand, moveAwayFrom); }, entity.identifier);
        entity.addCommand(callbackCommand, commandQueueItem.repeat);
      }
      commandQueueItem.succeeded();
    } else {
      let targetIsType = this.isType(target);
      let moveAwayFromIsType = this.isType(moveAwayFrom);
      if (target === moveAwayFrom) {
        this.printErrorMsg("Debug MoveAway: Can't move away entity from itself\n");
        commandQueueItem.succeeded();
        return;
      }
      // move away entity from entity
      if (!targetIsType && !moveAwayFromIsType) {
        let entity = this.getEntity(target);
        let moveAwayFromEntity = this.getEntity(moveAwayFrom);
        if (entity === moveAwayFromEntity) {
          commandQueueItem.succeeded();
          return;
        }
        entity.moveAway(commandQueueItem, moveAwayFromEntity);
      } else if (targetIsType && !moveAwayFromIsType) {
        // move away type from entity
        let targetEntities = this.getEntities(target);
        let moveAwayFromEntity = this.getEntity(moveAwayFrom);
        if (moveAwayFromEntity !== undefined) {
          for (var i = 0; i < targetEntities.length; i++) {
            // not move if it's same entity
            if (targetEntities[i].identifier === moveAwayFromEntity.identifier) {
              continue;
            }
            let callbackCommand = new CallbackCommand(this, () => { }, () => { this.moveAway(callbackCommand, moveAwayFrom); }, targetEntities[i].identifier);
            targetEntities[i].addCommand(callbackCommand, commandQueueItem.repeat);
          }
        }
        commandQueueItem.succeeded();
      } else if (!targetIsType && moveAwayFromIsType) {
        // move away entity from type
        let entity = this.getEntity(target);
        let moveAwayFromEntities = this.getEntities(moveAwayFrom);
        if (moveAwayFromEntities.length > 0) {
          let closestTarget = [Number.MAX_VALUE, -1];
          for (let i = 0; i < moveAwayFromEntities.length; i++) {
            if (entity.identifier === moveAwayFromEntities[i].identifier) {
              continue;
            }
            let distance = entity.getDistance(moveAwayFromEntities[i]);
            if (distance < closestTarget[0]) {
              closestTarget = [distance, i];
            }
          }
          if (closestTarget[1] !== -1) {
            entity.moveAway(commandQueueItem, moveAwayFromEntities[closestTarget[1]]);
          }
        } else {
          commandQueueItem.succeeded();
        }
      } else {
        // move away type from type
        let entities = this.getEntities(target);
        let moveAwayFromEntities = this.getEntities(moveAwayFrom);
        if (moveAwayFromEntities.length > 0 && entities.length > 0) {
          for (let i = 0; i < entities.length; i++) {
            let entity = entities[i];
            let closestTarget = [Number.MAX_VALUE, -1];
            for (let j = 0; j < moveAwayFromEntities.length; j++) {
              // not move if it's same entity
              if (moveAwayFromEntities[i].identifier === entity.identifier) {
                continue;
              }
              let distance = entity.getDistance(moveAwayFromEntities[j]);
              if (distance < closestTarget[0]) {
                closestTarget = [distance, j];
              }
            }
            if (closestTarget !== -1) {
              let callbackCommand = new CallbackCommand(this, () => { }, () => { this.moveAway(callbackCommand, moveAwayFromEntities[closestTarget[1]].identifier); }, entity.identifier);
              entity.addCommand(callbackCommand, commandQueueItem.repeat);
            } else {
              commandQueueItem.succeeded();
            }
          }
          commandQueueItem.succeeded();
        }
      }
    }
  }


  /**
   * @param {any} commandQueueItem
   * @param {any} moveTowardTo (entity identifier)
   *
   * @memberOf GameController
   */
  moveToward(commandQueueItem, moveTowardTo) {
    var target = commandQueueItem.target;
    // apply to all entities
    if (target === undefined) {
      let entities = this.levelEntity.entityMap;
      for (var value of entities) {
        let entity = value[1];
        let callbackCommand = new CallbackCommand(this, () => { }, () => { this.moveToward(callbackCommand, moveTowardTo); }, entity.identifier);
        entity.addCommand(callbackCommand, commandQueueItem.repeat);
      }
      commandQueueItem.succeeded();
    } else {
      let targetIsType = this.isType(target);
      let moveTowardToIsType = this.isType(moveTowardTo);
      if (target === moveTowardTo) {
        commandQueueItem.succeeded();
        return;
      }
      // move toward entity to entity
      if (!targetIsType && !moveTowardToIsType) {
        let entity = this.getEntity(target);
        let moveTowardToEntity = this.getEntity(moveTowardTo);
        entity.moveToward(commandQueueItem, moveTowardToEntity);
      } else if (targetIsType && !moveTowardToIsType) {
        // move toward type to entity
        let targetEntities = this.getEntities(target);
        let moveTowardToEntity = this.getEntity(moveTowardTo);
        if (moveTowardToEntity !== undefined) {
          for (let i = 0; i < targetEntities.length; i++) {
            // not move if it's same entity
            if (targetEntities[i].identifier === moveTowardToEntity.identifier) {
              continue;
            }
            let callbackCommand = new CallbackCommand(this, () => { }, () => { this.moveToward(callbackCommand, moveTowardTo); }, targetEntities[i].identifier);
            targetEntities[i].addCommand(callbackCommand, commandQueueItem.repeat);
          }
          commandQueueItem.succeeded();
        }
      } else if (!targetIsType && moveTowardToIsType) {
        // move toward entity to type
        let entity = this.getEntity(target);
        let moveTowardToEntities = this.getEntities(moveTowardTo);
        if (moveTowardToEntities.length > 0) {
          let closestTarget = [Number.MAX_VALUE, -1];
          for (let i = 0; i < moveTowardToEntities.length; i++) {
            // not move if it's same entity
            if (moveTowardToEntities[i].identifier === entity.identifier) {
              continue;
            }
            let distance = entity.getDistance(moveTowardToEntities[i]);
            if (distance < closestTarget[0]) {
              closestTarget = [distance, i];
            }
          }
          // there is valid target
          if (closestTarget[1] !== -1) {
            entity.moveToward(commandQueueItem, moveTowardToEntities[closestTarget[1]]);
          } else {
            commandQueueItem.succeeded();
          }
        } else {
          commandQueueItem.succeeded();
        }
      } else {
        // move toward type to type
        let entities = this.getEntities(target);
        let moveTowardToEntities = this.getEntities(moveTowardTo);
        if (moveTowardToEntities.length > 0 && entities.length > 0) {
          for (let i = 0; i < entities.length; i++) {
            let entity = entities[i];
            let closestTarget = [Number.MAX_VALUE, -1];
            for (let j = 0; j < moveTowardToEntities.length; j++) {
              // not move if it's same entity
              if (moveTowardToEntities[i].identifier === entity.identifier) {
                continue;
              }
              let distance = entity.getDistance(moveTowardToEntities[j]);
              if (distance < closestTarget[0]) {
                closestTarget = [distance, j];
              }
            }
            if (closestTarget[1] !== -1) {
              let callbackCommand = new CallbackCommand(this, () => { }, () => { this.moveToward(callbackCommand, moveTowardToEntities[closestTarget[1]].identifier); }, entity.identifier);
              entity.addCommand(callbackCommand, commandQueueItem.repeat);
            }
          }
          commandQueueItem.succeeded();
        }
      }
    }
  }

  positionEquivalence(lhs, rhs) {
    return (lhs[0] === rhs[0] && lhs[1] === rhs[1]);
  }

  /**
   * Run a command. If no `commandQueueItem.target` is provided, the command
   * will be applied to all targets.
   *
   * @param commandQueueItem
   * @param command
   * @param commandArgs
   */
  execute(commandQueueItem, command, ...commandArgs) {
    let target = commandQueueItem.target;
    if (!this.isType(target)) {
      if (target === undefined) {
        // Apply to all entities.
        let entities = this.levelEntity.entityMap;
        for (let value of entities) {
          let entity = value[1];
          let callbackCommand = new CallbackCommand(this, () => { }, () => { this.execute(callbackCommand, command, ...commandArgs); }, entity.identifier);
          entity.addCommand(callbackCommand, commandQueueItem.repeat);
        }
        commandQueueItem.succeeded();
      } else {
        // Apply to the given target.
        let entity = this.getEntity(target);
        entity[command](commandQueueItem, ...commandArgs);
      }
    } else {
      // Apply to all targets of the given type.
      let entities = this.getEntities(target);
      for (let i = 0; i < entities.length; i++) {
        let callbackCommand = new CallbackCommand(this, () => { }, () => { this.execute(callbackCommand, command, ...commandArgs); }, entities[i].identifier);
        entities[i].addCommand(callbackCommand, commandQueueItem.repeat);
      }
      commandQueueItem.succeeded();
    }
  }

  moveForward(commandQueueItem) {
    this.execute(commandQueueItem, 'moveForward');
  }

  moveBackward(commandQueueItem) {
    this.execute(commandQueueItem, 'moveBackward');
  }

  moveDirection(commandQueueItem, direction) {
    let player = this.levelModel.player;
    let shouldRide = this.levelModel.shouldRide(direction);
    if (shouldRide) {
      player.handleGetOnRails(direction);
      commandQueueItem.succeeded();
    } else {
      this.execute(commandQueueItem, 'moveDirection', direction);
    }
  }

  turn(commandQueueItem, direction) {
    this.execute(commandQueueItem, 'turn', direction);
  }

  turnRandom(commandQueueItem) {
    this.execute(commandQueueItem, 'turnRandom');
  }

  flashEntity(commandQueueItem) {
    let target = commandQueueItem.target;
    if (!this.isType(target)) {
      // apply to all entities
      if (target === undefined) {
        let entities = this.levelEntity.entityMap;
        for (let value of entities) {
          let entity = value[1];
          let callbackCommand = new CallbackCommand(this, () => { }, () => { this.flashEntity(callbackCommand); }, entity.identifier);
          entity.addCommand(callbackCommand, commandQueueItem.repeat);
        }
        commandQueueItem.succeeded();
      } else {
        let entity = this.getEntity(target);
        let delay = this.levelView.flashSpriteToWhite(entity.sprite);
        this.addCommandRecord("flash", entity.type, commandQueueItem.repeat);
        this.delayBy(delay, () => {
          commandQueueItem.succeeded();
        });
      }
    } else {
      let entities = this.getEntities(target);
      for (let i = 0; i < entities.length; i++) {
        let callbackCommand = new CallbackCommand(this, () => { }, () => { this.flashEntity(callbackCommand); }, entities[i].identifier);
        entities[i].addCommand(callbackCommand, commandQueueItem.repeat);
      }
      commandQueueItem.succeeded();
    }
  }

  explodeEntity(commandQueueItem) {
    let target = commandQueueItem.target;
    if (!this.isType(target)) {
      // apply to all entities
      if (target === undefined) {
        let entities = this.levelEntity.entityMap;
        for (let value of entities) {
          let entity = value[1];
          let callbackCommand = new CallbackCommand(this, () => { }, () => { this.explodeEntity(callbackCommand); }, entity.identifier);
          entity.addCommand(callbackCommand, commandQueueItem.repeat);
        }
        commandQueueItem.succeeded();
      } else {
        let targetEntity = this.getEntity(target);
        this.levelView.playExplosionCloudAnimation(targetEntity.position);
        this.addCommandRecord("explode", targetEntity.type, commandQueueItem.repeat);
        this.levelView.audioPlayer.play("explode");
        let entities = this.levelEntity.entityMap;
        for (let value of entities) {
          let entity = value[1];
          for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
              if (i === 0 && j === 0) {
                continue;
              }
              let position = [targetEntity.position[0] + i, targetEntity.position[1] + j];
              this.destroyBlockWithoutPlayerInteraction(position);
              if (entity.position[0] === targetEntity.position[0] + i && entity.position[1] === targetEntity.position[1] + j) {
                entity.blowUp(commandQueueItem, targetEntity.position);
              }
            }
          }
        }

        let callbackCommand = new CallbackCommand(this, () => { }, () => { this.destroyEntity(callbackCommand, targetEntity.identifier); }, targetEntity.identifier);
        targetEntity.queue.startPushHighPriorityCommands();
        targetEntity.addCommand(callbackCommand, commandQueueItem.repeat);
        targetEntity.queue.endPushHighPriorityCommands();
      }
      commandQueueItem.succeeded();
      this.updateFowPlane();
      this.updateShadingPlane();
    } else {
      let entities = this.getEntities(target);
      for (let i = 0; i < entities.length; i++) {
        let callbackCommand = new CallbackCommand(this, () => { }, () => { this.explodeEntity(callbackCommand); }, entities[i].identifier);
        entities[i].addCommand(callbackCommand, commandQueueItem.repeat);
      }
      commandQueueItem.succeeded();
    }
  }

  wait(commandQueueItem, time) {
    let target = commandQueueItem.target;
    if (!this.isType(target)) {
      let entity = this.getEntity(target);
      this.addCommandRecord("wait", entity.type, commandQueueItem.repeat);
      setTimeout(() => { commandQueueItem.succeeded(); }, time * 1000 / this.tweenTimeScale);
    } else {
      let entities = this.getEntities(target);
      for (let i = 0; i < entities.length; i++) {
        let callbackCommand = new CallbackCommand(this, () => { }, () => { this.wait(callbackCommand, time); }, entities[i].identifier);
        entities[i].addCommand(callbackCommand, commandQueueItem.repeat);
      }
      commandQueueItem.succeeded();
    }
  }

  spawnEntity(commandQueueItem, type, spawnDirection) {
    this.addCommandRecord("spawn", type, commandQueueItem.repeat);
    let spawnedEntity = this.levelEntity.spawnEntity(type, spawnDirection);
    if (spawnedEntity !== null) {
      this.events.forEach(e => e({ eventType: EventType.WhenSpawned, targetType: type, targetIdentifier: spawnedEntity.identifier }));
    }
    commandQueueItem.succeeded();
  }

  spawnEntityAt(commandQueueItem, type, x, y, facing) {
    let spawnedEntity = this.levelEntity.spawnEntityAt(type, x, y, facing);
    if (spawnedEntity !== null) {
      this.events.forEach(e => e({ eventType: EventType.WhenSpawned, targetType: type, targetIdentifier: spawnedEntity.identifier }));
    }
    commandQueueItem.succeeded();
  }

  destroyEntity(commandQueueItem, target) {
    if (!this.isType(target)) {
      // apply to all entities
      if (target === undefined) {
        let entities = this.levelEntity.entityMap;
        for (let value of entities) {
          let entity = value[1];
          let callbackCommand = new CallbackCommand(this, () => { }, () => { this.destroyEntity(callbackCommand, entity.identifier); }, entity.identifier);
          entity.addCommand(callbackCommand, commandQueueItem.repeat);
        }
        commandQueueItem.succeeded();
      } else {
        this.addCommandRecord("destroy", this.type, commandQueueItem.repeat);
        let entity = this.getEntity(target);
        if (entity !== undefined) {
          entity.healthPoint = 1;
          entity.takeDamage(commandQueueItem);
        } else {
          commandQueueItem.succeeded();
        }
      }
    } else {
      let entities = this.getEntities(target);
      for (let i = 0; i < entities.length; i++) {
        let entity = entities[i];
        let callbackCommand = new CallbackCommand(this, () => { }, () => { this.destroyEntity(callbackCommand, entity.identifier); }, entity.identifier);
        entity.addCommand(callbackCommand, commandQueueItem.repeat);
      }
      commandQueueItem.succeeded();
    }
  }

  drop(commandQueueItem, itemType) {
    let target = commandQueueItem.target;
    if (!this.isType(target)) {
      // apply to all entities
      if (target === undefined) {
        let entities = this.levelEntity.entityMap;
        for (let value of entities) {
          let entity = value[1];
          let callbackCommand = new CallbackCommand(this, () => { }, () => { this.drop(callbackCommand, itemType); }, entity.identifier);
          entity.addCommand(callbackCommand, commandQueueItem.repeat);
        }
        commandQueueItem.succeeded();
      } else {
        let entity = this.getEntity(target);
        entity.drop(commandQueueItem, itemType);
      }
    } else {
      let entities = this.getEntities(target);
      for (let i = 0; i < entities.length; i++) {
        let callbackCommand = new CallbackCommand(this, () => { }, () => { this.drop(callbackCommand, itemType); }, entities[i].identifier);
        entities[i].addCommand(callbackCommand, commandQueueItem.repeat);
      }
      commandQueueItem.succeeded();
    }
  }

  attack(commandQueueItem) {
    let target = commandQueueItem.target;
    if (!this.isType(target)) {
      // apply to all entities
      if (target === undefined) {
        let entities = this.levelEntity.entityMap;
        for (let value of entities) {
          let entity = value[1];
          let callbackCommand = new CallbackCommand(this, () => { }, () => { this.attack(callbackCommand); }, entity.identifier);
          entity.addCommand(callbackCommand, commandQueueItem.repeat);
        }
        commandQueueItem.succeeded();
      } else {
        let entity = this.getEntity(target);
        if (entity.identifier === 'Player') {
          this.codeOrgAPI.destroyBlock(() => { }, entity.identifier);
          commandQueueItem.succeeded();
        } else {
          entity.attack(commandQueueItem);
        }
      }
    } else {
      let entities = this.getEntities(target);
      for (let i = 0; i < entities.length; i++) {
        let callbackCommand = new CallbackCommand(this, () => { }, () => { this.attack(callbackCommand); }, entities[i].identifier);
        entities[i].addCommand(callbackCommand, commandQueueItem.repeat);
      }
      commandQueueItem.succeeded();
    }
  }

  playSound(commandQueueItem, sound) {
    this.addCommandRecord("playSound", undefined, commandQueueItem.repeat);
    this.levelView.audioPlayer.play(sound);
    commandQueueItem.succeeded();
  }

  use(commandQueueItem) {
    let player = this.levelModel.player;
    let frontPosition = this.levelModel.getMoveForwardPosition(player);
    let frontEntity = this.levelEntity.getEntityAt(frontPosition);
    let frontBlock = this.levelModel.actionPlane.getBlockAt(frontPosition);

    const isFrontBlockDoor = frontBlock === undefined ? false : frontBlock.blockType === "door";
    if (frontEntity !== null && frontEntity !== this.agent) {
      // push use command to execute general use behavior of the entity before executing the event
      this.levelView.setSelectionIndicatorPosition(frontPosition[0], frontPosition[1]);
      this.levelView.onAnimationEnd(this.levelView.playPlayerAnimation("punch", player.position, player.facing, false), () => {

        frontEntity.queue.startPushHighPriorityCommands();
        let useCommand = new CallbackCommand(this, () => { }, () => { frontEntity.use(useCommand, player); }, frontEntity.identifier);
        const isFriendlyEntity = this.levelEntity.isFriendlyEntity(frontEntity.type);
        // push frienly entity 1 block
        if (!isFriendlyEntity) {
          const pushDirection = player.facing;
          let moveAwayCommand = new CallbackCommand(this, () => { }, () => { frontEntity.pushBack(moveAwayCommand, pushDirection, 150); }, frontEntity.identifier);
          frontEntity.addCommand(moveAwayCommand);
        }
        frontEntity.addCommand(useCommand);
        frontEntity.queue.endPushHighPriorityCommands();
        this.levelView.playPlayerAnimation("idle", player.position, player.facing, false);
        if (this.getIsDirectPlayerControl()) {
          this.delayPlayerMoveBy(0, 0, () => {
            commandQueueItem.succeeded();
          });
        } else {
          commandQueueItem.waitForOtherQueue = true;
        }
        setTimeout(() => { this.levelView.setSelectionIndicatorPosition(player.position[0], player.position[1]); }, 0);
      });
    } else if (isFrontBlockDoor) {
      this.levelView.setSelectionIndicatorPosition(frontPosition[0], frontPosition[1]);
      this.levelView.onAnimationEnd(this.levelView.playPlayerAnimation("punch", player.position, player.facing, false), () => {
        this.audioPlayer.play("doorOpen");
        // if it's not walable, then open otherwise, close
        const canOpen = !frontBlock.isWalkable;
        this.levelView.playDoorAnimation(frontPosition, canOpen, () => {
          frontBlock.isWalkable = !frontBlock.isWalkable;
          this.levelView.playIdleAnimation(player.position, player.facing, player.isOnBlock);
          this.levelView.setSelectionIndicatorPosition(player.position[0], player.position[1]);
          commandQueueItem.succeeded();
        });
      });
    } else if (frontBlock && frontBlock.isRail) {
      this.levelView.playTrack(frontPosition, player.facing, true, player, null);
      commandQueueItem.succeeded();
    } else {
      this.levelView.playPunchDestroyAirAnimation(player.position, player.facing, this.levelModel.getMoveForwardPosition(), () => {
        this.levelView.setSelectionIndicatorPosition(player.position[0], player.position[1]);
        this.levelView.playIdleAnimation(player.position, player.facing, player.isOnBlock);
        this.delayPlayerMoveBy(0, 0, () => {
          commandQueueItem.succeeded();
        });
      });
    }
  }

  destroyBlock(commandQueueItem) {
    let player = this.getEntity(commandQueueItem.target);
    // if there is a destroyable block in front of the player
    if (this.levelModel.canDestroyBlockForward(player)) {
      let block = this.levelModel.actionPlane.getBlockAt(this.levelModel.getMoveForwardPosition(player));

      if (block !== null) {
        let destroyPosition = this.levelModel.getMoveForwardPosition(player);
        let blockType = block.blockType;

        if (block.isDestroyable) {
          switch (blockType) {
            case "logAcacia":
            case "treeAcacia":
              blockType = "planksAcacia";
              break;
            case "logBirch":
            case "treeBirch":
              blockType = "planksBirch";
              break;
            case "logJungle":
            case "treeJungle":
              blockType = "planksJungle";
              break;
            case "logOak":
            case "treeOak":
              blockType = "planksOak";
              break;
            case "logSpruce":
            case "treeSpruce":
              blockType = "planksSpruce";
              break;
          }
          this.levelView.playDestroyBlockAnimation(player.position, player.facing, destroyPosition, blockType, player, () => {
            commandQueueItem.succeeded();
          });
        } else if (block.isUsable) {
          switch (blockType) {
            case "sheep":
              // TODO: What to do with already sheered sheep?
              this.levelView.playShearSheepAnimation(player.position, player.facing, destroyPosition, blockType, () => {
                commandQueueItem.succeeded();
              });

              break;
            default:
              commandQueueItem.succeeded();
          }
        } else {
          commandQueueItem.succeeded();
        }
      }
      // if there is a entity in front of the player
    } else {
      this.levelView.playPunchDestroyAirAnimation(player.position, player.facing, this.levelModel.getMoveForwardPosition(player), () => {
        this.levelView.setSelectionIndicatorPosition(player.position[0], player.position[1]);
        this.levelView.playIdleAnimation(player.position, player.facing, player.isOnBlock, player);
        this.delayPlayerMoveBy(0, 0, () => {
          commandQueueItem.succeeded();
        });
      }, player);
    }
  }

  destroyBlockWithoutPlayerInteraction(position) {
    if (!this.levelModel.inBounds(position)) {
      return;
    }
    let block = this.levelModel.actionPlane.getBlockAt(position);

    if (block !== null && block !== undefined) {
      let destroyPosition = position;
      let blockType = block.blockType;

      if (block.isDestroyable) {
        switch (blockType) {
          case "logAcacia":
          case "treeAcacia":
            blockType = "planksAcacia";
            break;
          case "logBirch":
          case "treeBirch":
            blockType = "planksBirch";
            break;
          case "logJungle":
          case "treeJungle":
            blockType = "planksJungle";
            break;
          case "logOak":
          case "treeOak":
            blockType = "planksOak";
            break;
          case "logSpruce":
          case "treeSpruce":
          case "logSpruceSnowy":
          case "treeSpruceSnowy":
            blockType = "planksSpruce";
            break;
        }
        this.levelView.destroyBlockWithoutPlayerInteraction(destroyPosition);
        this.levelView.playExplosionAnimation(this.levelModel.player.position, this.levelModel.player.facing, position, blockType, () => { }, false);
        this.levelView.createMiniBlock(destroyPosition[0], destroyPosition[1], blockType);
        this.updateFowPlane();
        this.updateShadingPlane();
      } else if (block.isUsable) {
        switch (blockType) {
          case "sheep":
            // TODO: What to do with already sheered sheep?
            this.levelView.playShearAnimation(this.levelModel.player.position, this.levelModel.player.facing, position, blockType, () => { });
            break;
        }
      }
    }

    // clear the block in level model (block info in 2d grid)
    this.levelModel.destroyBlock(position);
  }

  checkTntAnimation() {
    return this.specialLevelType === 'freeplay';
  }

  checkMinecartLevelEndAnimation() {
    return this.specialLevelType === 'minecart';
  }

  checkHouseBuiltEndAnimation() {
    return this.specialLevelType === 'houseBuild';
  }

  checkAgentSpawn() {
    return this.specialLevelType === 'agentSpawn';
  }

  placeBlock(commandQueueItem, blockType) {
    const player = this.getEntity(commandQueueItem.target);
    const position = player.position;
    let blockAtPosition = this.levelModel.actionPlane.getBlockAt(position);
    let blockTypeAtPosition = blockAtPosition.blockType;

    if (this.levelModel.canPlaceBlock(player, blockAtPosition)) {
      if (blockTypeAtPosition !== "") {
        this.levelModel.destroyBlock(position);
      }

      if (blockType !== "cropWheat" || this.levelModel.groundPlane.getBlockAt(player.position).blockType === "farmlandWet") {
        this.levelModel.player.updateHidingBlock(player.position);
        if (this.checkMinecartLevelEndAnimation() && blockType === "rail") {
          // Special 'minecart' level places a mix of regular and powered tracks, depending on location.
          if (player.position[1] < 7) {
            blockType = "railsUnpoweredVertical";
          } else {
            blockType = "rails";
          }
        }
        this.levelView.playPlaceBlockAnimation(player.position, player.facing, blockType, blockTypeAtPosition, player, () => {
          const entity = convertNameToEntity(blockType, position.x, position.y);
          if (entity) {
            this.levelEntity.spawnEntityAt(...entity);
          } else {
            this.levelModel.placeBlock(blockType, player);
            this.updateFowPlane();
            this.updateShadingPlane();
          }
          this.delayBy(200, () => {
            this.levelView.playIdleAnimation(player.position, player.facing, false, player);
          });
          this.delayPlayerMoveBy(200, 400, () => {
            commandQueueItem.succeeded();
          });
        });
      } else {
        let signalBinding = this.levelView.playPlayerAnimation("jumpUp", player.position, player.facing, false, player).onLoop.add(() => {
          this.levelView.playIdleAnimation(player.position, player.facing, false, player);
          signalBinding.detach();
          this.delayBy(800, () => commandQueueItem.succeeded());
        }, this);
      }
    } else {
      commandQueueItem.succeeded();
    }
  }

  setPlayerActionDelayByQueueLength() {
    if (!this.levelModel.usePlayer) {
      return;
    }

    let START_SPEED_UP = 10;
    let END_SPEED_UP = 20;

    let queueLength = this.levelModel.player.queue.getLength();
    let speedUpRangeMax = END_SPEED_UP - START_SPEED_UP;
    let speedUpAmount = Math.min(Math.max(queueLength - START_SPEED_UP, 0), speedUpRangeMax);

    this.playerDelayFactor = 1 - (speedUpAmount / speedUpRangeMax);
  }

  delayBy(ms, completionHandler) {
    let timer = this.game.time.create(true);
    timer.add(this.originalMsToScaled(ms), completionHandler, this);
    timer.start();
    this.resettableTimers.push(timer);
  }

  delayPlayerMoveBy(minMs, maxMs, completionHandler) {
    this.delayBy(Math.max(minMs, maxMs * this.playerDelayFactor), completionHandler);
  }

  originalMsToScaled(ms) {
    let realMs = ms / this.assumedSlowMotion;
    return realMs * this.game.time.slowMotion;
  }

  originalFpsToScaled(fps) {
    let realFps = fps * this.assumedSlowMotion;
    return realFps / this.game.time.slowMotion;
  }

  placeBlockForward(commandQueueItem, blockType) {
    this.placeBlockDirection(commandQueueItem, blockType, 0);
  }

  placeBlockDirection(commandQueueItem, blockType, direction) {
    let player = this.getEntity(commandQueueItem.target);
    let position,
      placementPlane,
      soundEffect = () => { };

    if (!this.levelModel.canPlaceBlockDirection(blockType, player, direction)) {
      this.levelView.playPunchAirAnimation(player.position, player.facing, player.position, () => {
        this.levelView.playIdleAnimation(player.position, player.facing, false, player);
        commandQueueItem.succeeded();
      }, player);
      return;
    }

    position = this.levelModel.getMoveDirectionPosition(player, direction);
    placementPlane = this.levelModel.getPlaneToPlaceOn(position, player, blockType);
    if (this.levelModel.isBlockOfTypeOnPlane(position, "lava", placementPlane)) {
      soundEffect = () => this.levelView.audioPlayer.play("fizz");
    }

    this.levelView.playPlaceBlockInFrontAnimation(player, player.position, player.facing, position, () => {
      this.levelModel.placeBlockDirection(blockType, placementPlane, player, direction);
      this.levelView.refreshGroundGroup();

      this.updateFowPlane();
      this.updateShadingPlane();
      soundEffect();

      this.delayBy(200, () => {
        this.levelView.playIdleAnimation(player.position, player.facing, false, player);
      });
      this.delayPlayerMoveBy(200, 400, () => {
        commandQueueItem.succeeded();
      });
    });
  }

  checkSolution() {
    if (!this.attemptRunning || this.resultReported) {
      return;
    }
    // check the final state to see if its solved
    if (this.levelModel.isSolved()) {
      const player = this.levelModel.player;
      if (this.checkHouseBuiltEndAnimation()) {
        this.resultReported = true;
        var houseBottomRight = this.levelModel.getHouseBottomRight();
        var inFrontOfDoor = new Position(houseBottomRight.x - 1, houseBottomRight.y + 2);
        var bedPosition = new Position(houseBottomRight.x, houseBottomRight.y);
        var doorPosition = new Position(houseBottomRight.x - 1, houseBottomRight.y + 1);
        this.levelModel.moveTo(inFrontOfDoor);
        this.levelView.playSuccessHouseBuiltAnimation(
          player.position,
          player.facing,
          player.isOnBlock,
          this.levelModel.houseGroundToFloorBlocks(houseBottomRight),
          [bedPosition, doorPosition],
          () => {
            this.endLevel(true);
          },
          () => {
            this.levelModel.destroyBlock(bedPosition);
            this.levelModel.destroyBlock(doorPosition);
            this.updateFowPlane();
            this.updateShadingPlane();
          }
        );
      } else if (this.checkMinecartLevelEndAnimation()) {
        this.resultReported = true;
        this.levelView.playMinecartAnimation(player.isOnBlock, () => {
          this.handleEndState(true);
        });
      } else if (this.checkAgentSpawn()) {
        this.resultReported = true;

        const levelEndAnimation = this.levelView.playLevelEndAnimation(player.position, player.facing, player.isOnBlock);

        levelEndAnimation.onComplete.add(() => {
          this.levelModel.spawnAgent(null, new Position(3, 4), 2); // This will spawn the Agent at [3, 4], facing South.
          this.levelView.agent = this.agent;
          this.levelView.resetEntity(this.agent);

          this.updateFowPlane();
          this.updateShadingPlane();
          this.delayBy(200, () => {
            this.endLevel(true);
          });
        });
      } else if (this.checkTntAnimation()) {
        this.resultReported = true;
        this.levelView.scaleShowWholeWorld(() => {});
        var tnt = this.levelModel.getTnt();
        var wasOnBlock = player.isOnBlock;
        this.levelView.playDestroyTntAnimation(player.position, player.facing, player.isOnBlock, this.levelModel.getTnt(), this.levelModel.shadingPlane,
          () => {
            for (var i in tnt) {
              if (tnt[i].x === this.levelModel.player.position.x && tnt[i].y === this.levelModel.player.position.y) {
                this.levelModel.player.isOnBlock = false;
              }
              var surroundingBlocks = this.levelModel.getAllBorderingPositionNotOfType(tnt[i], "tnt");
              this.levelModel.destroyBlock(tnt[i]);
              for (var b = 1; b < surroundingBlocks.length; ++b) {
                if (surroundingBlocks[b][0]) {
                  this.destroyBlockWithoutPlayerInteraction(surroundingBlocks[b][1]);
                }
              }
            }
            if (!player.isOnBlock && wasOnBlock) {
              this.levelView.playPlayerJumpDownVerticalAnimation(player.facing, player.position);
            }
            this.updateFowPlane();
            this.updateShadingPlane();
            this.delayBy(200, () => {
              this.levelView.playSuccessAnimation(player.position, player.facing, player.isOnBlock, () => {
                this.endLevel(true);
              });
            });
          });
      } else {
        this.endLevel(true);
      }
    } else if (this.levelModel.isFailed() || !(this.getIsDirectPlayerControl() || this.levelData.isAquaticLevel)) {
      // For "Events" levels, check the final state to see if it's failed.
      // Procedural levels only call `checkSolution` after all code has run, so
      // fail if we didn't pass the success condition.
      this.endLevel(false);
    }
  }

  endLevel(result) {
    if (!this.levelModel.usePlayer) {
      if (result) {
        this.levelView.audioPlayer.play("success");
      } else {
        this.levelView.audioPlayer.play("failure");
      }
      this.resultReported = true;
      this.handleEndState(result);
      return;
    }
    if (result) {
      let player = this.levelModel.player;
      let callbackCommand = new CallbackCommand(this, () => { }, () => {
        this.levelView.playSuccessAnimation(player.position, player.facing, player.isOnBlock, () => { this.handleEndState(true); });
      }, player.identifier);
      player.queue.startPushHighPriorityCommands();
      player.addCommand(callbackCommand, this.isRepeat);
      player.queue.endPushHighPriorityCommands();
    } else {
      let player = this.levelModel.player;
      let callbackCommand = new CallbackCommand(this, () => { }, () => { this.destroyEntity(callbackCommand, player.identifier); }, player.identifier);
      player.queue.startPushHighPriorityCommands();
      player.addCommand(callbackCommand, this.isRepeat);
      player.queue.endPushHighPriorityCommands();
    }
  }

  addScore(commandQueueItem, score) {
    this.addCommandRecord("addScore", undefined, commandQueueItem.repeat);
    if (this.useScore) {
      this.score += score;
      this.updateScore();
    }
    commandQueueItem.succeeded();
  }

  updateScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.score);
    }
  }

  isPathAhead(blockType) {
    return this.player.isOnBlock ? true : this.levelModel.isForwardBlockOfType(blockType);
  }

  addCommand(commandQueueItem) {
    // there is a target, push command to the specific target
    if (commandQueueItem.target !== undefined) {
      let target = this.getEntity(commandQueueItem.target);
      target.addCommand(commandQueueItem, this.isRepeat);
    } else {
      this.queue.addCommand(commandQueueItem, this.isRepeat);
      this.queue.begin();
    }
  }

  addGlobalCommand(commandQueueItem) {
    let entity = this.levelEntity.entityMap.get(commandQueueItem.target);
    if (entity !== undefined) {
      entity.addCommand(commandQueueItem, this.isRepeat);
    } else {
      this.queue.addCommand(commandQueueItem, this.isRepeat);
      this.queue.begin();
    }
  }

  startDay(commandQueueItem) {
    if (this.levelModel.isDaytime) {
      if (commandQueueItem !== undefined && commandQueueItem !== null) {
        commandQueueItem.succeeded();
      }
      if (this.DEBUG) {
        this.game.debug.text("Impossible to start day since it's already day time\n");
      }
    } else {
      if (this.onDayCallback !== undefined) {
        this.onDayCallback();
      }
      this.levelModel.isDaytime = true;
      this.levelModel.clearFow();
      this.levelView.updateFowGroup(this.levelModel.fowPlane);
      this.events.forEach(e => e({ eventType: EventType.WhenDayGlobal }));
      let entities = this.levelEntity.entityMap;
      for (let value of entities) {
        let entity = value[1];
        this.events.forEach(e => e({ eventType: EventType.WhenDay, targetIdentifier: entity.identifier, targetType: entity.type }));
      }
      let zombieList = this.levelEntity.getEntitiesOfType('zombie');
      for (let i = 0; i < zombieList.length; i++) {
        zombieList[i].setBurn(true);
      }
      if (commandQueueItem !== undefined && commandQueueItem !== null) {
        commandQueueItem.succeeded();
      }
    }
  }

  startNight(commandQueueItem) {
    if (!this.levelModel.isDaytime) {
      if (commandQueueItem !== undefined && commandQueueItem !== null) {
        commandQueueItem.succeeded();
      }
      if (this.DEBUG) {
        this.game.debug.text("Impossible to start night since it's already night time\n");
      }
    } else {
      if (this.onNightCallback !== undefined) {
        this.onNightCallback();
      }
      this.levelModel.isDaytime = false;
      this.levelModel.computeFowPlane();
      this.levelView.updateFowGroup(this.levelModel.fowPlane);
      this.events.forEach(e => e({ eventType: EventType.WhenNightGlobal }));
      let entities = this.levelEntity.entityMap;
      for (let value of entities) {
        let entity = value[1];
        this.events.forEach(e => e({ eventType: EventType.WhenNight, targetIdentifier: entity.identifier, targetType: entity.type }));
      }
      let zombieList = this.levelEntity.getEntitiesOfType('zombie');
      for (let i = 0; i < zombieList.length; i++) {
        zombieList[i].setBurn(false);
      }
      if (commandQueueItem !== undefined && commandQueueItem !== null) {
        commandQueueItem.succeeded();
      }
    }
  }

  initiateDayNightCycle(firstDelay, delayInSecond, startTime) {
    if (startTime === "day" || startTime === "Day") {
      this.timeouts.push(setTimeout(() => {
        this.startDay(null);
        this.setDayNightCycle(delayInSecond, "night");
      }, firstDelay * 1000));
    } else if (startTime === "night" || startTime === "Night") {
      this.timeouts.push(setTimeout(() => {
        this.startNight(null);
        this.setDayNightCycle(delayInSecond, "day");
      }, firstDelay * 1000));
    }
  }

  setDayNightCycle(delayInSecond, startTime) {
    if (!this.dayNightCycle) {
      return;
    }
    if (startTime === "day" || startTime === "Day") {
      this.timeouts.push(setTimeout(() => {
        if (!this.dayNightCycle) {
          return;
        }
        this.startDay(null);
        this.setDayNightCycle(delayInSecond, "night");
      }, delayInSecond * 1000));
    } else if (startTime === "night" || startTime === "Night") {
      this.timeouts.push(setTimeout(() => {
        if (!this.dayNightCycle) {
          return;
        }
        this.startNight(null);
        this.setDayNightCycle(delayInSecond, "day");
      }, delayInSecond * 1000));
    }
  }

  arrowDown(direction) {
    if (!this.levelModel.usePlayer) {
      return;
    }
    this.player.movementState = direction;
    this.player.updateMovement();
  }

  arrowUp(direction) {
    if (!this.levelModel.usePlayer) {
      return;
    }
    if (this.player.movementState === direction) {
      this.player.movementState = -1;
    }
    this.player.updateMovement();
  }

  clickDown() {
    if (!this.levelModel.usePlayer) {
      return;
    }
    this.player.movementState = -2;
    this.player.updateMovement();
  }

  clickUp() {
    if (!this.levelModel.usePlayer) {
      return;
    }
    if (this.player.movementState === -2) {
      this.player.movementState = -1;
    }
    this.player.updateMovement();
  }

  updateFowPlane() {
    this.levelModel.computeFowPlane();
    this.levelView.updateFowGroup(this.levelModel.fowPlane);
  }

  updateShadingPlane() {
    this.levelModel.computeShadingPlane();
    this.levelView.updateShadingGroup(this.levelModel.shadingPlane);
  }
}
