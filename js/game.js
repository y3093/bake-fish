var BakeFish = {};
cc.game.onStart = function(){
    cc.view.enableAutoFullScreen(!1);
    !cc.sys.isNative && document.getElementById("cocosLoading") && document
        .body.removeChild(document.getElementById("cocosLoading"));
    cc.view.enableRetina(false);
    cc.view.adjustViewPort(true);
    var radio = cc.view.getFrameSize().width / 480;
    cc.view.setDesignResolutionSize(480, Math.floor(cc.view.getFrameSize().height / radio), cc.ResolutionPolicy.SHOW_ALL);
    cc.view.resizeWithBrowserSize(true);
    // 预加载图片资源
    cc.LoaderScene.preload(g_resources, function () {
        cc.director.runScene(new MenuScene);
    }, this);
};

var res = {
        'bg': 'res/bg.png',
        'asset': 'res/asset.png',
        'asset_plist': 'res/asset.plist',
        'panel': 'res/panel.png',
        'title': 'res/title.png',
        'btnStart': 'res/btn-start.png'
    },
    // 烤鱼状态对应数值
    FISH_STATUS = {
        EMPTY: 1,
        BLUE: 2,
        YELLOW: 3,
        RED: 4,
        DIED: 5
    },
    // 游戏参数设置
    GAMES = {
        FISH_WAIT_TIME: 3.6,  // 烤鱼等待时长
        MIN_WAIT_TIME: 1.6,   // 最小等待时间
        NOW_SCORE: 0,         // 当前分数
        SCORE: {
            RED: 30,          // 红色鱼分数+30分
            YELLOW: 10,       // 黄色鱼分数+10分
            BLUE: -10         // 蓝色鱼分数-10分
        },
        FISH_COUNT: 6,        // 烤鱼数量
        TIME: 60              // 游戏时长
    },
    g_resources = [];

for (var key in res) {
    g_resources.push(res[key]);
}

/**
 * MenuScene 菜单场景
 */
var MenuScene = cc.Scene.extend({
    onEnter:function () {
        this._super();
        var winSize = cc.winSize;
        // 背景层
        var bg = new cc.Sprite(res.bg);
        bg.attr({
            x: winSize.width / 2,
            y: winSize.height / 2,
            scaleX: winSize.width / bg.width,
            scaleY: winSize.height / bg.height
        });
        this.addChild(bg);

        var title = new cc.Sprite(res.title);
        title.attr({
          scaleX: 0.6,
          scaleY: 0.6,
          x: winSize.width / 2,
          y: winSize.height - title.height / 2
        });
        this.addChild(title);

        var btnStart = new cc.Sprite(res.btnStart);
        btnStart.attr({
          scaleX: 0.6,
          scaleY: 0.6,
          x: winSize.width / 2,
          y: 160
        });
        this.addChild(btnStart);

        var startEvt = cc.EventListener.create({
              event: cc.EventListener.TOUCH_ONE_BY_ONE,
              onTouchBegan: function(touch, event) {
                var target = event.getCurrentTarget(),
                    posInNode = target.convertToNodeSpace(touch.getLocation()),
                    size = target.getContentSize(),
                    rect = cc.rect(0, 0, size.width, size.height);
                // 点击到指定节点
                if(cc.rectContainsPoint(rect, posInNode)) { 
                  BakeFish.startGame();
                  return true;
                }
                return false;
              }
            });
        cc.eventManager.addListener(startEvt, btnStart);
    }
});

/**
 * GameScene(游戏场景)
 */
var GameScene = cc.Scene.extend({
    onEnter: function() {
        this._super();
        this.gameLayer = new GameLayer();
        this.addChild(this.gameLayer);
    }
});

/**
 * 游戏层(GameLayer)
 */
var GameLayer = cc.Layer.extend({
    onEnter: function() {
        this._super();
        var winSize = cc.winSize;
        cc.spriteFrameCache.addSpriteFrames(res.asset_plist, res.asset);

        // 背景层
        var bg = new cc.Sprite(res.bg);
        bg.attr({
            x: winSize.width / 2,
            y: winSize.height / 2,
            scaleX: winSize.width / bg.width,
            scaleY: winSize.height / bg.height
        });
        this.addChild(bg);

        // 烤鱼面包
        var panel = new cc.Sprite(res.panel);
        panel.attr({
            x: winSize.width / 2,
            y: winSize.height / 2
        });
        this.addChild(panel);

        // 烤鱼层
        this.fishLayer = new FishLayer();
        this.fishLayer.attr({
            y: winSize.height / 2,
            anchorY: 0.5
        });
        this.fishLayer.setAnchorPoint(0, 0.5);
        this.addChild(this.fishLayer);

        // 分数
        this.scoreLabel = new cc.LabelTTF('0', 'Arial', 40, cc.TEXT_ALIGNMENT_CENTER);
        this.scoreLabel.attr({
            anchorX: 0.5,
            x: winSize.width / 2,
            y: panel.y + 330,
            _strokeSize: 3,
            _strokeEnabled: true
        });
        this.scoreLabel.strokeStyle = cc.color(199, 34, 34, 100);
        this.addChild(this.scoreLabel);

        // 分数
        this.timeLabel = new cc.LabelTTF(GAMES.TIME + 's', 'Arial', 26, cc.TEXT_ALIGNMENT_CENTER);
        this.timeLabel.time = GAMES.TIME;
        this.timeLabel.attr({
            anchorX: 1,
            x: winSize.width - 20,
            y: panel.y + 330,
            _strokeSize: 3,
            _strokeEnabled: true
        });
        this.timeLabel.strokeStyle = cc.color(199, 34, 34, 100);
        this.addChild(this.timeLabel);
        this.schedule(this.updateTimeLabel, 1);
        this.scheduleUpdate();
    },
    // 更新游戏分数文本
    updateScoreLabel: function(score) {
        this.scoreLabel.setString(score);
    },
    // 更新时间文本
    updateTimeLabel: function() {
        this.timeLabel.setString(this.timeLabel.time-- + 's');
    },
    update: function(data) {
        if(this.fishLayer.fishCount <= 0 || this.timeLabel.time < 0) {
            this.gameOver();
            this.unscheduleUpdate();
            cc.director.pause();
        } else if(this.fishWaitTime > GAMES.MIN_WAIT_TIME && !(this.fishLayer.clickCount % 30)) {
            // 每收鱼30次，总时长-0.3s
            this.fishLayer.clickCount++;
            this.fishWaitTime -= 0.3;
        }
    },
    // 游戏结束
    gameOver: function() {
        var _score = GAMES.NOW_SCORE;
        cc.director.runScene(new GameoverScene);
    }
});

// 烤鱼层
var FishLayer = cc.Layer.extend({
    onEnter: function() {
        this._super();
        var _fish = {},
            _timeBar = {};
        this.clickCount = 0;
        this.fishArr = [];
        this.fishCount = GAMES.FISH_COUNT;
        this.fishWaitTime = GAMES.FISH_WAIT_TIME;
        for (var i = 0; i < GAMES.FISH_COUNT; i++) {
            _fish = GetFishSprite();
            _fish.attr({
                x: i % 3 * 156 + 84,            // 第i条鱼的x值
                y: 230 * ( i > 2 ? 1 : 0) - 120 // 第i条鱼的y值
            });
            _fish.status = FISH_STATUS.BLUE;
            this.addChild(_fish);
            _fish.startBurned();
            this.fishArr.push(_fish);
        }
        var _this = this,
            // 点击鱼事件
            listener = cc.EventListener.create({
              event: cc.EventListener.TOUCH_ONE_BY_ONE,
              onTouchBegan: function(touch, event) {
                  _this.clickFish(touch, event);
                  return false;
              }
            });
        cc.eventManager.addListener(listener, this);
    },
    // 点击鱼事件
    clickFish: function(touch, event) {
        var locationInNode = {},
            target = {},
            size = {},
            rect = {};
        for (var i = 0, j = this.fishArr.length; i < j; i++) {
            target = this.fishArr[i];
            size = target.getContentSize();
            rect = cc.rect(0, 0, size.width, size.height);
            locationInNode = target.convertToNodeSpace(touch.getLocation());
            // 点击到鱼
            if(cc.rectContainsPoint(rect, locationInNode)) {
                switch(target.status) {
                    // case FISH_STATUS.EMPTY:
                    //     target.setSpriteFrame('fishBlue.png');
                    //     target.status++;
                    //     target.setLoadbarVisible(target, true);
                    //     target.startBurned.call(target);
                    //     break;
                    case FISH_STATUS.BLUE:
                        // target.setSpriteFrame('fishYellow.png');
                        GAMES.NOW_SCORE += GAMES.SCORE.BLUE;
                        if(GAMES.NOW_SCORE < 0) {
                            GAMES.NOW_SCORE = 0;
                        }
                        this.parent.updateScoreLabel(GAMES.NOW_SCORE);
                        target.showScore(GAMES.SCORE.BLUE);
                        break;
                    // 收起黄色鱼并加分
                    case FISH_STATUS.YELLOW:
                        target.setSpriteFrame('fishBlue.png');
                        target.wasteTime = 0;
                        target.status = FISH_STATUS.BLUE;
                        GAMES.NOW_SCORE += GAMES.SCORE.YELLOW;
                        this.parent.updateScoreLabel(GAMES.NOW_SCORE);
                        target.showScore(GAMES.SCORE.YELLOW);
                        this.clickCount++;
                        break;
                    // 收起红色鱼并加分
                    case FISH_STATUS.RED:
                        target.setSpriteFrame('fishBlue.png');
                        target.wasteTime = 0;
                        target.status = FISH_STATUS.BLUE;
                        GAMES.NOW_SCORE += GAMES.SCORE.RED;
                        this.parent.updateScoreLabel(GAMES.NOW_SCORE);
                        target.showScore(GAMES.SCORE.RED);
                        this.clickCount++;
                        break;
                    // case FISH_STATUS.DIED:
                    //     // 点到烤焦的鱼，占住位置不处理
                    //     break;
                    default:
                        break;
                }
                return true;
            }
        }
    }
});

/**
 * 创建鱼精灵
 */
var GetFishSprite = function() {
    var fish = new cc.Sprite('#fishBlue.png');
    // 时间条背景
    fish.barBg = new cc.Sprite('#barBg.png');
    fish.barBg.attr({
        anchorX: 0,
        anchorY: 0.5,
        x: (150 - 136) / 2,
        y: fish.barBg.height
    });
    fish.addChild(fish.barBg);
    // 时间条进度
    fish.barStatus = new cc.Sprite('#barStatus.png');
    fish.barStatus.attr({
        anchorX: 0,
        anchorY: 0.5,
        x: (150 - 136) / 2,
        y: fish.barStatus.height
    });
    fish.addChild(fish.barStatus);
    // 分数
    fish.addScoreLabel = new cc.LabelTTF('+10', 'Arial', 30, cc.TEXT_ALIGNMENT_CENTER);
    fish.addScoreLabel.attr({
        x: 136 / 2,
        y: fish.height / 2,
        visible: false,
        _strokeSize: 2,
        _strokeEnabled: true
    });
    fish.addScoreLabel.strokeStyle = cc.color(199, 34, 34, 100);
    fish.addChild(fish.addScoreLabel);

    // 开始烤鱼
    fish.startBurned = function() {
        var additionalTime = 0.1,
            _this = this,
            percent = 0;
        this.wasteTime = 0;
        this.callBack = function() {
            _this.wasteTime += additionalTime;
            percent = (_this.parent.fishWaitTime - _this.wasteTime) / _this.parent.fishWaitTime;
            if(_this.wasteTime >= _this.parent.fishWaitTime) {
                _this.status = FISH_STATUS.DIED;
                _this.setSpriteFrame('fishFail.png');
                _this.unschedule(this.callBack);
                _this.setLoadbarVisible(false);
                this.parent.fishCount--;
                return;
            }
            // 时间剩余70%时变为黄鱼
            if(Math.floor(percent * 10) / 10 == 0.7) {
                _this.status = FISH_STATUS.YELLOW;
                _this.setSpriteFrame('fishYellow.png');
            } else if(Math.floor(percent * 10) / 10 == 0.2) {
            // 时间剩余20%时变为红鱼
                _this.status = FISH_STATUS.RED;
                _this.setSpriteFrame('fishRed.png');
            }
            _this.barStatus.setScaleX(percent);
        };
        this.schedule(this.callBack, additionalTime);
    };
    // 显示时间条
    fish.setLoadbarVisible = function(isVisible) {
        this.barBg.setVisible(isVisible);
        this.barStatus.setVisible(isVisible);
    };
    // 显示加分效果
    fish.showScore = function(num) {
        this.addScoreLabel.setString(num > 0 ? '+' + num : num);
        this.addScoreLabel.setVisible(true);
        this.addScoreLabel.attr({
            y: this.height / 2,
            visible: true
        });
        this.addScoreLabel.stopAllActions();
        this.addScoreLabel.runAction(
            cc.sequence(
                cc.moveBy(0.3, cc.p(0, 30)),
                cc.hide()
            )
        );
    }
    return fish;
};

/**
 * Gameover 游戏结束场景
 */
var GameoverScene = cc.Scene.extend({
  onEnter: function() {
    this._super();
    var winSize = cc.winSize;

    var bg = new cc.Sprite(res.bg);
    bg.attr({
        x: winSize.width / 2,
        y: winSize.height / 2,
        scaleX: winSize.width / bg.width,
        scaleY: winSize.height / bg.height
    });
    this.addChild(bg);

    // Gameover标题(文字, 字体, 字号, 文本居中模式)
    var title = new cc.LabelTTF('Game Over', 'Arial', 70, cc.TEXT_ALIGNMENT_CENTER);
    title.attr({
      anchorX: 0.5,
      x: winSize.width / 2,
      y: winSize.height - 300,
      _strokeSize: 3,  // 文字描边尺寸: 3
      _strokeEnabled: true // 是否出现描边: true
    });
    title.strokeStyle = cc.color(199, 34, 34, 100);
    this.addChild(title);

    var scoreLabel = new cc.LabelTTF('Your score: ' + GAMES.NOW_SCORE, 'Arial', 40, cc.TEXT_ALIGNMENT_CENTER);
    scoreLabel.attr({
        anchorX: 0.5,
        x: winSize.width / 2,
        y: winSize.height - 400,
        _strokeSize: 2,
        _strokeEnabled: true
    });
    scoreLabel.strokeStyle = cc.color(199, 34, 34, 100);
    this.addChild(scoreLabel);

    var btnRestart = new cc.LabelTTF('Restart', 'Arial', 30, cc.TEXT_ALIGNMENT_CENTER);
    btnRestart.attr({
      anchorX: 0.5,
      x: 140,
      y: 300,
      _strokeSize: 2,
      _strokeEnabled: true
    });
    btnRestart.strokeStyle = cc.color(3, 3, 3, 100);
    this.addChild(btnRestart);

    var goHome = new cc.LabelTTF('Go Home', 'Arial', 30, cc.TEXT_ALIGNMENT_CENTER);
    goHome.attr({
      anchorX: 0.5,
      x: cc.winSize.width - 140,
      y: 300,
      _strokeSize: 2,
      _strokeEnabled: true
    });
    goHome.strokeStyle = cc.color(3, 3, 3, 100);
    this.addChild(goHome);

    // 重新开始事件
    var restartEvt = cc.EventListener.create({
          event: cc.EventListener.TOUCH_ONE_BY_ONE,
          onTouchBegan: function(touch, event) {
            var target = event.getCurrentTarget(),
                posInNode = target.convertToNodeSpace(touch.getLocation()),
                size = target.getContentSize(),
                rect = cc.rect(0, 0, size.width, size.height);
            // 点击到指定节点
            if(cc.rectContainsPoint(rect, posInNode)) { 
              BakeFish.replayGame();
              return true;
            }
            return false;
          }
        });
    cc.eventManager.addListener(restartEvt, btnRestart);

    // 返回首页事件
    var goHomeEvt = cc.EventListener.create({
          event: cc.EventListener.TOUCH_ONE_BY_ONE,
          onTouchBegan: function(touch, event) {
            var target = event.getCurrentTarget(),
                posInNode = target.convertToNodeSpace(touch.getLocation()),
                size = target.getContentSize(),
                rect = cc.rect(0, 0, size.width, size.height);
            // 点击到指定节点
            if(cc.rectContainsPoint(rect, posInNode)) { 
              cc.director.runScene(new MenuScene);
              return true;
            }
            return false;
          }
        });
    cc.eventManager.addListener(goHomeEvt, goHome);
  }
});

/**
 * 初始化开始/结束事件
 */
(function(Bake) {
    Bake.startGame = Bake.replayGame = function() {
        cc.director.runScene(new GameScene);
        if(cc.director._paused) {
            cc.director.resume();
        }
    };
    // 开始游戏
    cc.game.run("gameCanvas");
})(BakeFish || (BakeFish = {}));