/* Conservative title-based category gate. Do not infer products from mere mentions. */
(function(root){'use strict';
 const rules={
  sports:{
   '登山杖':{want:/登山杖|徒步杖/i,deny:/替换|更换|备用|雪篮|杖尖|杆尖|杖头|防滑头|脚垫|杖套|手杖配件/},
   '徒步鞋':{want:/徒步鞋|登山鞋/i,deny:/鞋套|鞋带|鞋垫|鞋底|鞋罩|护套|配件|替换|清洁刷/},
   '户外背包':{want:/户外背包|徒步背包|登山包/i,deny:/背包杯|背包罩|背包雨罩|背包旅行|背包吊床|配件|炊具|吊床|背包炉/},
   '运动短裤':{want:/运动短裤|跑步短裤|健身短裤|训练短裤|瑜伽短裤|篮球短裤|骑行短裤/i,deny:/泳裤|内裤|睡裤|家居裤|儿童|婴儿|童装|套装|模型|配件|替换|裤垫/},
   '运动上衣':{want:/运动上衣|运动T恤|运动衫|运动背心|运动短袖|运动长袖|健身上衣|健身T恤|健身背心|健身短袖|跑步上衣|跑步T恤|跑步背心|训练上衣|训练T恤|训练背心|瑜伽上衣|瑜伽T恤|瑜伽背心/i,deny:/内衣|胸罩|文胸|睡衣|泳装|泳衣|儿童|婴儿|童装|套装|模型|配件|替换/}
  },
  moving:{
   '办公椅':{want:/办公椅|办公.{0,8}椅|电脑椅|书桌椅/i,deny:/椅套|座套|椅垫|扶手套|脚轮|椅轮|护套|替换|配件|坐垫/},
   '办公桌':{want:/办公桌|电脑桌|书桌|写字台|学习桌|升降桌|游戏桌/i,deny:/椅|桌垫|桌布|桌套|桌面贴|装饰|模型|支架|配件|替换|脚轮|桌腿|单独桌面/},
   '书架':{want:/书架|书柜/i,deny:/办公桌|电脑桌|书桌|写字台|学习桌|升降桌|游戏桌|桌子|书挡|书立|隔板|夹板|装饰|模型|配件|替换|贴纸|墙贴|椅/},
   '电脑支架':{want:/电脑支架|笔记本支架/i,deny:/电脑桌|书桌|写字台|办公桌|游戏桌|支架配件|替换/},
   '台灯':{want:/台灯/i,deny:/阳台灯|灯夹|夹具|挂钩|灯串|灯泡|灯罩|配件|替换/}
  }
 };
 function matches(scene,category,title){const r=rules[scene]?.[category];if(!r||typeof title!=='string')return false;if(scene==='sports'&&['运动短裤','运动上衣'].includes(category)&&/儿童|婴儿|童装|男童|女童|睡衣|睡裤|泳衣|泳裤|泳装|文胸|胸罩|内裤|套装|模型|配件|替换/i.test(title))return false;if(scene==='moving'&&category==='书架'&&/办公桌|电脑桌|书桌|写字台|学习桌|升降桌|游戏桌|桌子/i.test(title))return false;const primary=title.split(/[，,；;。|]/,1)[0];return r.want.test(primary)&&!r.deny.test(primary)}
 const api={matches};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.shoppingProductRules=api;
})(typeof window==='undefined'?globalThis:window);
