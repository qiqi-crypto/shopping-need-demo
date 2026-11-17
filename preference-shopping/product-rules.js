/* Conservative title-based category gate. Do not infer products from mere mentions. */
(function(root){'use strict';
 const rules={
  sports:{
   '登山杖':{want:/登山杖|徒步杖/i,deny:/替换|更换|备用|雪篮|杖尖|杆尖|杖头|防滑头|脚垫|杖套|手杖配件/},
   '徒步鞋':{want:/徒步鞋|登山鞋/i,deny:/鞋套|鞋带|鞋垫|鞋底|鞋罩|护套|配件|替换|清洁刷/},
   '户外背包':{want:/户外背包|徒步背包|登山包/i,deny:/背包杯|背包罩|背包雨罩|背包旅行|背包吊床|配件|炊具|吊床|背包炉/}
  },
  moving:{
   '办公椅':{want:/办公椅|办公.{0,8}椅|电脑椅|书桌椅/i,deny:/椅套|座套|椅垫|扶手套|脚轮|椅轮|护套|替换|配件|坐垫/},
   '电脑支架':{want:/电脑支架|笔记本支架/i,deny:/电脑桌|书桌|写字台|办公桌|游戏桌|支架配件|替换/},
   '台灯':{want:/台灯/i,deny:/阳台灯|灯夹|夹具|挂钩|灯串|灯泡|灯罩|配件|替换/}
  }
 };
 function matches(scene,category,title){const r=rules[scene]?.[category];if(!r||typeof title!=='string')return false;const primary=title.split(/[，,；;。|]/,1)[0];return r.want.test(primary)&&!r.deny.test(primary)}
 const api={matches};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.shoppingProductRules=api;
})(typeof window==='undefined'?globalThis:window);
