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
			state: "earlyLoad",
			// TODO(bjordan): remove now that using canvas 
			preserveDrawingBuffer: false // enables saving .png screengrabs
		});

		this.specialLevelType = null;
		this.queue = new CommandQueue(this);
		this.OnCompleteCallback = null;

		this.assetRoot = gameControllerConfig.assetRoot;

		this.audioPlayer = gameControllerConfig.audioPlayer;
		this.afterAssetsLoaded = gameControllerConfig.afterAssetsLoaded;
		this.assetLoader = new AssetLoader(this);
		this.earlyLoadAssetPacks = gameControllerConfig.earlyLoadAssetPacks || [];
		this.earlyLoadNiceToHaveAssetPacks = gameControllerConfig.earlyLoadNiceToHaveAssetPacks || [];

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
		this.dayNightCycle = null;
		this.player = null;
		this.agent = null;

		this.timerSprite = null;

		this.game.state.add("earlyLoad", {
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

		this.game.state.add("levelRunner", {
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
		this.dayNightCycle = Number.parseInt(levelConfig.dayNightCycle);
		this.timeout = levelConfig.levelVerificationTimeout;
		if (levelConfig.useScore !== undefined) {
			this.useScore = levelConfig.useScore;
		}
		this.timeoutResult = levelConfig.timeoutResult;
		this.onDayCallback = levelConfig.onDayCallback;
		this.onNightCallback = levelConfig.onNightCallback;

		if (!Number.isNaN(this.dayNightCycle) && this.dayNightCycle > 1000) {
			this.setDayNightCycle(this.dayNightCycle, "day");
		}
		this.game.state.start("levelRunner");
	}

	reset() {
		this.dayNightCycle = null;
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
				if (event.eventType === EventType.WhenUsed && event.targetType === "sheep") {
					this.codeOrgAPI.drop(null, "wool", event.targetIdentifier);
				}
				if (event.eventType === EventType.WhenTouched && event.targetType === "creeper") {
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
		this.game.load.image("timer", `${this.assetRoot}images/placeholderTimer.png`);
		this.game.load.onLoadComplete.addOnce(() => {
			if (this.afterAssetsLoaded) {
				this.afterAssetsLoaded();
			}
		});
		this.levelEntity.loadData(this.levelData);
		this.game.load.start();
	}

	run(onErrorCallback, apiObject) {
		/* Execute user/designer's code */
		try {
			new Function('api', `'use strict'; ${this.levelData.script}`)(apiObject);
		} catch (err) {
			onErrorCallback(err);
		}
		// dispatch when spawn event at run
		this.events.forEach(e => e({ eventType: EventType.WhenRun, targetIdentifier: undefined }));
		for (let value of this.levelEntity.entityMap) {
			var entity = value[1];
			this.events.forEach(e => e({ eventType: EventType.WhenSpawned, targetType: entity.type, targetIdentifier: entity.identifier }));
			entity.queue.begin();
		}
		// set timeout for timeout
		const isNumber = !Number.isNaN(this.timeout);
		if (isNumber && this.timeout > 0) {
			this.timerSprite = this.game.add.sprite(-50, 390, "timer");
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
			[Phaser.Keyboard.SPACEBAR]: -2,
			[Phaser.Keyboard.BACKSPACE]: -3
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
			this.game.debug.text(this.game.time.fps || "--", 2, 14, "#00ff00");
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
		for (let i = 0; i < commandList.length; i++) {
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
			target = "Player";
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
		return typeof (target) === "string" && (target !== "Player" && target !== "PlayerAgent");
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
			for (let value of entities) {
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
					for (let i = 0; i < targetEntities.length; i++) {
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
			for (let value of entities) {
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
		this.execute(commandQueueItem, "moveForward");
	}

	moveBackward(commandQueueItem) {
		this.execute(commandQueueItem, "moveBackward");
	}

	moveDirection(commandQueueItem, direction) {
		let player = this.levelModel.player;
		let shouldRide = this.levelModel.shouldRide(direction);
		if (shouldRide) {
			player.handleGetOnRails(direction);
			commandQueueItem.succeeded();
		} else {
			this.execute(commandQueueItem, "moveDirection", direction);
		}
	}

	turn(commandQueueItem, direction) {
		this.execute(commandQueueItem, "turn", direction);
	}

	turnRandom(commandQueueItem) {
		this.execute(commandQueueItem, "turnRandom");
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
				if (entity.identifier === "Player") {
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

		const isFrontBlockDoor = !!frontBlock && frontBlock.blockType === "door";
		if (player.movementState == -3) {
			//player.movementState = -1;
			this.destroyBlock(commandQueueItem);
			return;
		}
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
			this.placeBlockForward(commandQueueItem, player.selectedItem);
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
		return this.specialLevelType === "freeplay";
	}

	checkMinecartLevelEndAnimation() {
		return this.specialLevelType === "minecart";
	}

	checkHouseBuiltEndAnimation() {
		return this.specialLevelType === "houseBuild";
	}

	checkAgentSpawn() {
		return this.specialLevelType === "agentSpawn";
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
						for (let i in tnt) {
							if (tnt[i].x === this.levelModel.player.position.x && tnt[i].y === this.levelModel.player.position.y) {
								this.levelModel.player.isOnBlock = false;
							}
							var surroundingBlocks = this.levelModel.getAllBorderingPositionNotOfType(tnt[i], "tnt");
							this.levelModel.destroyBlock(tnt[i]);
							for (let b = 1; b < surroundingBlocks.length; ++b) {
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
			let zombieList = this.levelEntity.getEntitiesOfType("zombie");
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
			let zombieList = this.levelEntity.getEntitiesOfType("zombie");
			for (let i = 0; i < zombieList.length; i++) {
				zombieList[i].setBurn(false);
			}
			if (commandQueueItem !== undefined && commandQueueItem !== null) {
				commandQueueItem.succeeded();
			}
		}
	}

	initiateDayNightCycle(firstDelay, delayInMs, startTime) {
		if (startTime === "day" || startTime === "Day") {
			this.timeouts.push(setTimeout(() => {
				this.startDay(null);
				this.setDayNightCycle(delayInMs, "night");
			}, firstDelay));
		} else if (startTime === "night" || startTime === "Night") {
			this.timeouts.push(setTimeout(() => {
				this.startNight(null);
				this.setDayNightCycle(delayInMs, "day");
			}, firstDelay));
		}
	}

	setDayNightCycle(delayInMs, startTime) {
		if (!this.dayNightCycle) {
			return;
		}
		if (startTime === "day" || startTime === "Day") {
			this.timeouts.push(setTimeout(() => {
				if (!this.dayNightCycle) {
					return;
				}
				this.startDay(null);
				this.setDayNightCycle(delayInMs, "night");
			}, delayInMs));
		} else if (startTime === "night" || startTime === "Night") {
			this.timeouts.push(setTimeout(() => {
				if (!this.dayNightCycle) {
					return;
				}
				this.startNight(null);
				this.setDayNightCycle(delayInMs, "day");
			}, delayInMs));
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

window.GameController = GameController;
