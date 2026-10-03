// Night Shift Zoo: every number and piece of story in one place. Distances in metres, times in seconds.
export const VERSION = '0.1.0';

export const WORLD = { size: 520, half: 205, wall: 11 };           // the zoo is a 410 m square inside a very tall brick wall
// Five days and five nights. Days run 8 AM to 8 PM, nights 8 PM to 6 AM; these are real seconds for each.
export const SHIFT = { days: 5, day: [200, 200, 210, 210, 220], night: [330, 360, 390, 420, 480], dusk: 22 };

export const PLAYER = {
  walk: 4.6, sprint: 7.6, crouch: 2.3, accel: 46, airAccel: 10, friction: 10, jump: 6.6, gravity: 22, coyote: 0.12, jumpBuffer: 0.14,
  health: 100, stamina: 100, eye: 1.64, crouchEye: 1.0, slideSpeed: 9.5, slideTime: 0.75
};

// Enclosures and places. x,z = centre, w,d = size. fence: 'wood' | 'metal' | 'heavy'. night = the first night it's open.
export const ZONES = [
  { theme: { g: [0.15, 0.36, 0.30], tint: [0.55, 0.8, 0.75], kinds: ['pine', 'pine', 'pine', 'dead_trees:0', 'trees:1'], tex: 'forest' }, id: 'wolves', name: 'Wolf Woods', x: -135, z: 55, w: 78, d: 64, fence: 'wood', species: 'wolf', count: 5, feed: 'meat', ground: 'forest', trees: 16, night: 1 },
  { theme: { g: [0.88, 0.69, 0.30], tint: [1.0, 0.86, 0.42], kinds: ['dead_trees:1', 'dead_trees:3', 'tree1'], tex: 'dry' }, id: 'savanna', name: 'The Savanna', x: -8, z: 30, w: 104, d: 78, fence: 'wood', species: 'zebra', also: [['bull', 2]], count: 5, feed: 'hay', ground: 'dry', trees: 4, night: 1 },
  { theme: { g: [0.38, 0.74, 0.30], tint: [0.85, 1.0, 0.62], kinds: ['birch:0', 'birch:2', 'birch:3', 'trees:0'], tex: 'grass', flowers: 1 }, id: 'meadow', name: 'Stag Meadow', x: -20, z: -92, w: 92, d: 70, fence: 'wood', species: 'stag', also: [['deer', 4]], count: 2, feed: 'hay', ground: 'grass', trees: 9, night: 2 },
  { theme: { g: [0.64, 0.42, 0.20], tint: [1.0, 0.5, 0.18], kinds: ['trees:2', 'trees:3', 'birch:1', 'tree1'], tex: 'forest' }, id: 'foxes', name: 'Fox Hollow', x: -150, z: -40, w: 44, d: 44, fence: 'wood', species: 'fox', count: 4, feed: 'meat', ground: 'forest', trees: 6, night: 2 },
  { theme: { g: [0.13, 0.45, 0.22], tint: [0.45, 0.95, 0.5], kinds: ['trees:4', 'trees:0', 'tree1', 'trees:2'], tex: 'forest', big: 1.35 }, id: 'raptors', name: 'Raptor Run', x: 132, z: 62, w: 66, d: 60, fence: 'metal', species: 'raptor', count: 4, feed: 'meat', ground: 'dry', trees: 5, night: 3 },
  { theme: { g: [0.27, 0.20, 0.42], tint: [0.72, 0.55, 1.0], kinds: ['dead_trees:0', 'dead_trees:2', 'dead_trees:4', 'pine'], tex: 'forest', shrooms: 1 }, id: 'nighthouse', name: 'The Night House', x: -138, z: -140, w: 70, d: 56, fence: 'heavy', species: 'yeti', also: [['spider', 4]], count: 1, feed: 'meat', ground: 'forest', trees: 10, night: 3, dark: true },
  { theme: { g: [0.74, 0.40, 0.25], tint: [0.8, 0.75, 0.4], kinds: ['dead_trees:3', 'tree1', 'dead_trees:1'], tex: 'dry', rocks: 14 }, id: 'valley', name: 'Thunder Valley', x: 118, z: -40, w: 112, d: 86, fence: 'metal', species: 'trike', also: [['stego', 2], ['para', 3], ['apato', 1]], count: 2, feed: 'hay', ground: 'grass', trees: 7, night: 4 },
  { theme: { g: [0.27, 0.25, 0.28], tint: [0.35, 0.33, 0.36], kinds: ['dead_trees:0', 'dead_trees:1', 'dead_trees:2', 'dead_trees:4'], tex: 'dry', rocks: 16, bones: 1 }, id: 'rex', name: 'Rex Kingdom', x: 110, z: -150, w: 120, d: 70, fence: 'heavy', species: 'trex', count: 1, feed: 'meat', ground: 'dry', trees: 6, night: 5 }
];
export const PLACES = {
  gate: { name: 'Main Gate', x: 0, z: 205 },
  plaza: { name: 'Entrance Plaza', x: 0, z: 150, r: 34 },
  hq: { name: "Keepers' Lodge", x: -62, z: 150 },
  store: { name: 'Feed Store', x: -96, z: 138 },
  generator: { name: 'Generator Shed', x: 70, z: 152 },
  tower: { name: 'Control Tower', x: 34, z: 176 },
  yard: { name: 'Maintenance Yard', x: 150, z: 150 },
  court: { name: 'Food Court', x: 55, z: -40 },
  play: { name: 'Playground', x: 60, z: 100 },
  lake: { name: 'Lily Pond', x: -75, z: -20, r: 20 }
};
// Re-Bean-imators: stand in one and hold E to bring back every friend who got eaten
export const REVIVE = [[16, 136], [-179, 4], [174, 20], [40, -146], [62, 12], [-74, 104]];
// Paths as chains of points (4 m wide, cobbled). They also become the route animals use to roam.
export const PATHS = [
  [[0, 238], [0, 150], [0, 96]],                                                   // gate to the hub
  [[-62, 150], [0, 150], [70, 152], [150, 150]],                                   // plaza street
  [[-96, 138], [-62, 150]],
  [[0, 96], [-80, 96], [-186, 96], [-186, -2], [-186, -90], [-186, -176], [-90, -176], [-90, -140], [34, -140], [34, -176], [180, -176], [180, -100]], // west and south loop
  [[0, 96], [70, 100], [180, 104], [180, 20], [180, -100]],                        // east loop
  [[-80, 96], [-80, -18], [-80, -50], [-108, -50]],                                 // lane between the wolves and the savanna
  [[-80, -50], [34, -50], [55, -40], [55, 20], [70, 100]],                         // middle lane and food court
  [[34, -50], [34, -140]],
  [[-186, -90], [-108, -90], [-80, -50]]
];

// Animals. size = height at the shoulder/head in metres. kind decides the brain.
export const SPECIES = {
  wolf:   { name: 'Wolf', size: 1.05, walk: 1.5, run: 7.4, dmg: 18, hp: 2, kind: 'pack', anims: { idle: 'Idle', idle2: 'Idle_2', low: 'Idle_2_HeadLow', walk: 'Walk', run: 'Gallop', attack: 'Attack', eat: 'Eating', death: 'Death', hit: 'Idle_HitReact_Left', jump: 'Gallop_Jump' }, voice: 'howl', eyes: 0xffd060 },
  fox:    { name: 'Fox', size: 0.6, walk: 1.6, run: 7.8, dmg: 6, hp: 1, kind: 'thief', anims: { idle: 'Idle', idle2: 'Idle_2', low: 'Idle_2_HeadLow', walk: 'Walk', run: 'Gallop', attack: 'Attack', eat: 'Eating', death: 'Death', hit: 'Idle_HitReact_Left', jump: 'Gallop_Jump' }, voice: 'yip', eyes: 0x9fffb0 },
  zebra:  { name: 'Zebra', size: 1.5, walk: 1.4, run: 8.5, dmg: 10, hp: 2, kind: 'herd', anims: { idle: 'Idle', walk: 'WalkSlow', run: 'Run', death: 'Death', jump: 'Jump' }, voice: 'bray', eyes: 0xffffff },
  bull:   { name: 'Bull', size: 1.7, walk: 1.2, run: 8.2, dmg: 34, hp: 3, kind: 'charger', anims: { idle: 'Idle', idle2: 'Idle_2', low: 'Idle_Headlow', walk: 'Walk', run: 'Gallop', attack: 'Attack_Headbutt', eat: 'Eating', death: 'Death', hit: 'Idle_HitReact_Left' }, voice: 'snort', eyes: 0xff5a3a },
  stag:   { name: 'Stag', size: 1.9, walk: 1.3, run: 8.0, dmg: 26, hp: 2, kind: 'charger', anims: { idle: 'Idle', idle2: 'Idle_2', low: 'Idle_Headlow', walk: 'Walk', run: 'Gallop', attack: 'Attack_Headbutt', eat: 'Eating', death: 'Death', hit: 'Idle_HitReact_Left' }, voice: 'bellow', eyes: 0x9fd8ff },
  deer:   { name: 'Deer', size: 1.4, walk: 1.3, run: 8.6, dmg: 0, hp: 1, kind: 'herd', anims: { idle: 'Idle', idle2: 'Idle_2', low: 'Idle_Headlow', walk: 'Walk', run: 'Gallop', eat: 'Eating', death: 'Death' }, voice: 'bray', eyes: 0x9fd8ff },
  raptor: { name: 'Raptor', size: 1.7, walk: 2.0, run: 9.2, dmg: 24, hp: 2, kind: 'pack', clever: true, anims: { idle: 'Velociraptor_Idle', walk: 'Velociraptor_Walk', run: 'Velociraptor_Run', attack: 'Velociraptor_Attack', death: 'Velociraptor_Death', jump: 'Velociraptor_Jump' }, voice: 'screech', eyes: 0xfff06a },
  trike:  { name: 'Triceratops', size: 3.0, walk: 1.2, run: 7.0, dmg: 40, hp: 4, kind: 'charger', breaker: true, anims: { idle: 'Triceratops_Idle', walk: 'Triceratops_Walk', run: 'Triceratops_Run', attack: 'Triceratops_Attack', death: 'Triceratops_Death' }, voice: 'bellow', eyes: 0xffb050 },
  stego:  { name: 'Stegosaurus', size: 3.4, walk: 1.0, run: 5.2, dmg: 30, hp: 4, kind: 'herd', anims: { idle: 'Stegosaurus_Idle', walk: 'Stegosaurus_Walk', run: 'Stegosaurus_Run', attack: 'Stegosaurus_Attack', death: 'Stegosaurus_Death' }, voice: 'bellow', eyes: 0xffb050 },
  para:   { name: 'Parasaur', size: 3.6, walk: 1.3, run: 8.0, dmg: 0, hp: 3, kind: 'herd', caller: true, anims: { idle: 'Parasaurolophus_Idle', walk: 'Parasaurolophus_Walk', run: 'Parasaurolophus_Run', attack: 'Parasaurolophus_Attack', death: 'Parasaurolophus_Death' }, voice: 'horn', eyes: 0xffe080 },
  apato:  { name: 'Apatosaurus', size: 9.5, walk: 0.9, run: 3.2, dmg: 0, hp: 9, kind: 'giant', anims: { idle: 'Apatosaurus_Idle', walk: 'Apatosaurus_Walk', run: 'Apatosaurus_Run', attack: 'Apatosaurus_Attack', death: 'Stegosaurus_Death' }, voice: 'horn', eyes: 0xffe080 },
  yeti:   { name: 'The Yeti', size: 3.1, walk: 2.4, run: 6.6, dmg: 45, hp: 5, kind: 'stalker', anims: { idle: 'Idle', walk: 'Walk', run: 'Run', attack: 'Punch', death: 'Death', hit: 'HitReact', duck: 'Duck', wave: 'Wave', no: 'No' }, voice: 'moan', eyes: 0x8fe8ff },
  spider: { name: 'Cave Spider', size: 0.8, walk: 2.2, run: 6.2, dmg: 9, hp: 1, kind: 'pack', anims: { idle: 'Spider_Idle', walk: 'Spider_Walk', run: 'Spider_Walk', attack: 'Spider_Attack', death: 'Spider_Death', jump: 'Spider_Jump' }, voice: 'hiss', eyes: 0xff3a5a },
  trex:   { name: 'The Rex', size: 6.4, walk: 2.6, run: 8.8, dmg: 80, hp: 8, kind: 'apex', breaker: true, anims: { idle: 'TRex_Idle', walk: 'TRex_Walk', run: 'TRex_Run', attack: 'TRex_Attack', death: 'TRex_Death', jump: 'TRex_Jump' }, voice: 'roar', eyes: 0xff4a2a }
};

export const UPGRADES = [
  { id: 'torch', name: 'Long-life Torch', icon: '🔦', desc: 'Your flashlight battery lasts 60% longer and shines further.', cost: 60, max: 2 },
  { id: 'boots', name: 'Trail Boots', icon: '🥾', desc: 'Sprint 10% faster and for longer per level.', cost: 70, max: 2 },
  { id: 'belt', name: 'Tool Belt', icon: '🧰', desc: 'Fix fences 40% faster per level.', cost: 60, max: 2 },
  { id: 'darts', name: 'Dart Case', icon: '🎯', desc: '+2 tranquiliser darts each night.', cost: 80, max: 2 },
  { id: 'yoke', name: 'Feed Yoke', icon: '🪣', desc: 'A full bucket no longer slows you down, and foxes cannot steal it.', cost: 90, max: 1 },
  { id: 'vest', name: 'Padded Vest', icon: '🦺', desc: 'Take 20% less damage per level.', cost: 100, max: 2 },
  { id: 'radio', name: 'Scanner Radio', icon: '📻', desc: 'Your map shows where every loose animal is.', cost: 120, max: 1 }
];

// What each night adds. Events fire at clock hours (20 = 8 PM, 30 = 6 AM).
export const NIGHTS = [
  { title: 'First Night', sub: 'Learn the rounds. Do not get eaten.', agitation: 0.6, events: [[23, 'radio', 'n1b'], [27, 'radio', 'n1c']], radio: 'n1a' },
  { title: 'The Long Dark', sub: 'The lights are old. So is the wiring.', agitation: 0.8, events: [[23.5, 'power'], [26, 'radio', 'n2b'], [28, 'power']], radio: 'n2a' },
  { title: 'Clever Girls', sub: 'The raptors watched you do the latch.', agitation: 0.95, events: [[22, 'radio', 'n3b'], [24, 'gates'], [25.5, 'power'], [27, 'yeti'], [28.5, 'gates']], radio: 'n3a' },
  { title: 'Thunder Valley', sub: 'A storm is coming over the hills.', agitation: 1.15, storm: 0.8, events: [[22, 'radio', 'n4b'], [23.5, 'stampede'], [25, 'power'], [26.5, 'yeti'], [28, 'gates']], radio: 'n4a' },
  { title: 'The Last Night', sub: 'Reach the Control Tower before dawn. Then choose.', agitation: 1.35, storm: 1, events: [[21.5, 'radio', 'n5b'], [22.5, 'power'], [24, 'rex'], [25.5, 'gates'], [26.5, 'power'], [27.5, 'radio', 'n5c']], radio: 'n5a' }
];

// Radio calls from Marlow, the day manager, and the notes you can find around the zoo.
export const RADIO = {
  intro: ['Marlow', "Morning, keepers! Marlow here, day manager. Come on in through the main gate. Mind the fountain."],
  slam: ['Marlow', "Ah. Yes. The gates are on a timer. They open again in five days. Did the advert not mention that?"],
  d1: ['Marlow', "Daytime's easy: fill the troughs, patch the fences, spend your pay at the Lodge. Ring the Lodge bell when you want night to start. It comes anyway."],
  n1a: ['Marlow', "Sun's down. Their eyes do a thing at night. Ignore it. If one gets out, dart it, then tag it and it gets carted home."],
  n1b: ['Marlow', "Eleven o'clock. They get restless about now. Hungry ones get restless faster."],
  n1c: ['Marlow', "Nearly dawn. If a friend got eaten, the Re-Bean-imators around the park will sort them out. Mostly."],
  d2: ['Marlow', "You lived! New arrivals today: stags in the meadow, foxes in the hollow. The foxes steal. Hold on to your bucket."],
  n2a: ['Marlow', "Night two. The generator's older than I am. If the park goes dark, get to the shed. They're braver in the dark."],
  n2b: ['Marlow', "You're doing fine. The last crew lasted two nights. They're fine too. Mostly."],
  d3: ['Marlow', "The Paleo Wing and the Night House open today. Don't ask where we got them. Lock. Every. Gate."],
  n3a: ['Marlow', "The raptors watched me do the latch for a week. Then they did it themselves."],
  n3b: ['Unknown', "...keepers? Can you hear me? Don't trust what Marlow tells you about the Director. Find my notes."],
  d4: ['Marlow', "Thunder Valley's yours today. Big, gentle, and they hate thunder. There's a storm tonight. Sorry."],
  n4a: ['Marlow', "If the triceratops runs, do not stand in front of the fence. Or behind it."],
  n4b: ['Dr. Vance', "It's Dr. Vance. I worked here. They're not kept here to be seen. They're kept here to be sold. Look in the Control Tower."],
  d5: ['Marlow', "Last day. One more enclosure: Rex Kingdom. Nobody feeds the Rex twice. Good luck with that."],
  n5a: ['Marlow', "Last night. Get to the Control Tower before dawn. I'm sorry I didn't mention the Rex sooner."],
  n5b: ['Dr. Vance', "The tower has two switches. One seals the Paleo Wing for the buyers. The other opens the north wall to the hills. You choose, keepers."],
  n5c: ['Director', "Seal the wing and there's a year's pay in it for each of you. Don't be sentimental. They're stock."],
  dawn: ['Marlow', "Six o'clock! You made it. Count your limbs and collect your pay."],
  wipe: ['Marlow', "Everyone got eaten. That is a LOT of paperwork. Let's pretend that night never happened and try it again."],
  power: ['Marlow', "That's the generator gone. Get to the shed and restart it before they notice the dark."],
  gates: ['Marlow', "Gate alarms. Somebody's had the latches. Check every gate."],
  yeti: ['Marlow', "The Night House door reads open. Torch on. Do not turn your back on it."],
  stampede: ['Marlow', "Thunder's got the valley moving. Stay off the east loop until they settle."],
  rex: ['Marlow', "The ground's shaking. That's the Rex at the fence. If it gets out: lights off, crouch, don't move. It sees motion."]
};
export const NOTES = [
  "Day 1. New keeper kit: torch, wrench, dart rifle. Rifle's for 'emergencies'. Asked what kind. Marlow laughed.",
  "The wolves all turn their heads at the same moment. All five. I timed it. It's when the Night House door cycles.",
  "Feed logs don't add up. Twice the meat goes to the Paleo Wing than the animals on the signs could eat.",
  "Found a crate in the yard stamped LIVE EXPORT. The paperwork lists 'breeding pair, dromaeosaur'.",
  "Vance says the founder didn't dig them up. He grew them. The amber room is under the Control Tower.",
  "The eyes. It's the feed. There's something in the feed that makes them shine. And makes them clever.",
  "The Yeti isn't a yeti. It's just the first thing they grew that lived. It hates being seen.",
  "Director toured buyers through at 3 AM. One asked how much for the big one. He said 'everything'.",
  "The north wall has a gate nobody uses. Beyond it, forty miles of empty hills. Vance has the key code: it's the founding year.",
  "If I don't come back from the Rex round, tell whoever reads this: they're not stock. Let them go."
];
export const ENDINGS = {
  out: { title: 'CLOCKED OUT', color: '#9fd8ff', text: "Five days. Five nights. The gates creak open and you walk out without looking back. Nobody ever went up the Control Tower, so nobody ever found out what the switches did. The zoo is hiring again next week." },
  seal: { title: 'CONTAINMENT', color: '#ff8a5c', text: "You seal the Paleo Wing. At dawn the trucks arrive, and by noon the cages are empty. Your bonus clears on Friday. The zoo reopens with new signs and the same old animals. Some nights you still hear clicking outside your window." },
  free: { title: 'INTO THE HILLS', color: '#8fe0a0', text: "The north wall rolls open. One by one they walk out under the sunrise: the herd, the raptors, the old Rex last of all. It stops, looks back at the tower for a long moment, and goes. The Director's cheque bounces. You don't mind." },
  truth: { title: 'WHISTLEBLOWER', color: '#ffd27a', text: "With Vance's notes on every news desk by sunrise, you open the north wall and call it in yourself. The Director is arrested at the gate with a suitcase. The hills are declared a reserve. They put your name on a small brass plaque by the Lodge." }
};
