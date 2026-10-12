import {guides,correctDescription,type DiagnosticCause} from './diagnostic-guide';
type Message={role:'user'|'assistant';content:string};
type Extra='transmission'|'bearing'|'steering'|'charging'|'aircon'|'cold_engine'|'white_smoke'|'blue_smoke'|'black_smoke'|'check_engine'|'hard_start';
type Signal=keyof typeof guides|'starting_unknown'|Extra;
type Question={id:string;text:string;choices:string[]};
type Entry=Omit<DiagnosticCause,'evidence'>;
const entry=(title:string,explanation:string,check:string,condition:string,parts:string[]=[]):Entry=>({title,explanation,check,condition,parts});
const extra:Record<Extra,Entry[]>={
 hard_start:[entry('Подача пального або умови запуску','Тривале прокручування до запуску може бути пов’язане з тиском пального, його подачею або даними датчиків.','Перевірити коди, тиск пального та оберти під час запуску за процедурою для цього двигуна.','Важливо знати, чи це лише після тривалої стоянки або на прогрітому двигуні.'),entry('Живлення під час запуску','Падіння напруги й повільне прокручування можуть ускладнювати запуск.','Перевірити напругу під навантаженням, клеми та швидкість прокручування.','Якщо стартер обертає двигун бадьоро, цю перевірку відділяють від проблем із подачею пального.')],
 check_engine:[entry('Блок керування зафіксував несправність','Check Engine означає, що збережено діагностичну інформацію. Сам індикатор не визначає конкретну деталь.','Зчитати коди OBD та умови їх появи до очищення; перевірити системи, на які вказують коди.','Якщо індикатор блимає й двигун працює нерівно, припиніть рух і зверніться по діагностику.')],
 transmission:[entry('Пробуксовування зчеплення або трансмісії','Якщо оберти зростають, а швидкість майже не змінюється, крутний момент може передаватися не повністю.','Уточнити тип коробки, зчитати її помилки й перевірити передачу тяги на СТО.','Важливо відрізнити від повільного набору самих обертів.'),entry('Порушення керування коробкою передач','Затримка перемикання або аварійний режим може змінити прискорення.','Перевірити індикацію передач, коди коробки та її поточні параметри.','Особливо якщо є ривки або затримка ввімкнення передачі.')],
 bearing:[entry('Підшипник маточини','Гул, який змінюється зі швидкістю та навантаженням у повороті, може виникати в підшипнику колеса.','Локалізувати шум, перевірити люфт і обертання коліс на СТО.','Сам гул ще не визначає несправне колесо.',['Підшипник маточини']),entry('Шини або інші елементи приводу','Нерівномірний знос шин і шум приводу також можуть давати гул під час руху.','Оглянути шини та порівняти шум на різному покритті; перевірити привід.','Якщо звук залежить від дороги, почати з огляду шин.')],
 steering:[entry('Шарніри приводу або кермового механізму','Клацання при повороті під тягою та стук під час обертання керма мають різні джерела.','Локалізувати звук: під час руху чи на місці; перевірити шарніри, тяги та кріплення.','За звуком не можна одразу підтвердити ШРУС або рейку.'),entry('Опора стійки або шарніри підвіски','Опора й шарніри можуть створювати звук під час повороту колеса.','Перевірити опори та шарніри під навантаженням на СТО.','Ця версія важливіша, якщо стук є і на нерівностях.')],
 charging:[entry('Система заряджання або її з’єднання','Індикатор акумулятора під час роботи двигуна може означати проблему заряджання.','Перевірити напругу заряджання, ремінний привід, кабелі та помилки системи.','Акумулятор не варто міняти без перевірки заряджання.')],
 aircon:[entry('Порушення роботи кондиціонера','Відсутність холодного повітря може бути пов’язана з холодоагентом, керуванням або роботою компресора.','Перевірити температури, тиск, герметичність і команду ввімкнення на СТО.','Заправлення без перевірки витоку не встановлює причину.'),entry('Обдув або регулювання температури','Заслінки, вентилятор чи забруднення фільтра можуть змінювати температуру й силу потоку.','Порівняти потік на різних режимах та перевірити керування заслінками.','Особливо якщо одна сторона салону охолоджується інакше.')],
 cold_engine:[entry('Термостат або контроль температури','Якщо прогрів надто довгий чи температура падає під час руху, варто перевірити термостат і показання температури.','Порівняти фактичну температуру через діагностику та поведінку системи охолодження.','Показання панелі самі по собі не підтверджують несправність термостата.',['Термостат'])],
 white_smoke:[entry('Конденсат або потрапляння рідини в циліндри','Короткочасна пара на холодному двигуні відрізняється від густого білого вихлопу після прогріву.','Уточнити, чи зникає вихлоп після прогріву та чи зменшується рівень охолоджувальної рідини; перевірити на СТО.','При перегріві або швидкій втраті рідини зупинити двигун.')],
 blue_smoke:[entry('Олива потрапляє у впуск або камеру згоряння','Синюватий вихлоп разом із витратою оливи може бути пов’язаний із вентиляцією картера, ущільненнями чи зносом.','Перевірити витрату оливи, вентиляцію картера та локалізувати джерело на СТО.','Наявність турбіни та момент появи диму змінюють напрямок перевірки.')],
 black_smoke:[entry('Порушення співвідношення повітря та пального','Чорний вихлоп може бути пов’язаний із недостатньою подачею повітря або порушенням впорскування.','Перевірити впуск, фактичні параметри повітря та пального, коди помилок.','Особливо якщо разом із димом є втрата тяги; деталь ще не визначена.')]
};
export function normalizeSymptoms(text:string){
 const words:Record<string,string>={'стукае':'стукає','стукает':'стукає','стучит':'стукає','стучить':'стукає','стукаї':'стукає','двигн':'двигун','двігун':'двигун','двигунн':'двигун','двигатель':'двигун','заводитса':'заводиться','заводица':'заводиться','заводится':'заводиться','заводитсья':'заводиться','заводитця':'заводиться','незаводиться':'не заводиться','нетянет':'не тягне','тянет':'тягне','обороты':'оберти','спереди':'спереду','сзади':'ззаду','холодную':'холодну','горячую':'гарячу','гарячую':'гарячу','медленно':'повільно','акумулятр':'акумулятор','аккумулятор':'акумулятор','скрепить':'скрипить','глохнет':'глохне','дергается':'смикається','троит':'троїть','троіть':'троїть','дым':'дим','дыма':'диму','дымит':'димить','дизельный':'дизель'};
 return correctDescription(text.toLowerCase().normalize('NFKC').replace(/[’`]/g,"'")).replace(/[\p{L}]+/gu,w=>words[w]||w).replace(/\s+/g,' ').trim();
}
const questions:Record<string,Question>={
 starting:{id:'starting',text:'Під час запуску стартер крутить двигун нормально, повільно чи зовсім не крутить?',choices:['Крутить нормально, але не заводиться','Крутить повільно','Не крутить, чути клацання']},
 power:{id:'power',text:'Коли натискаєте газ, оберти теж зростають повільно чи зростають швидко, а авто майже не прискорюється?',choices:['Оберти теж зростають повільно','Оберти ростуть, швидкість майже ні']},
 engine_temperature:{id:'engine_temperature',text:'Стук зникає після прогріву чи залишається на гарячому двигуні?',choices:['Лише на холодну','Залишається після прогріву']},
 knock_location:{id:'knock_location',text:'Стук чути від двигуна, на нерівностях чи під час повороту керма?',choices:['Стукає двигун','Стук на ямах','Стук при повороті']},
 smoke:{id:'smoke',text:'Якого кольору дим і чи зникає він після прогріву?',choices:['Чорний дим','Синій дим','Білий дим після прогріву','Диму немає']},
 generic:{id:'generic',text:'Опишіть, що змінилося: запуск, тяга, звук, температура чи індикатор на панелі?',choices:['Не заводиться','Втратила тягу','Стукає двигун','Стук на нерівностях']}
 ,codes:{id:'codes',text:'Які коди помилок показав сканер? Якщо ще не перевіряли, напишіть це.',choices:['Коди ще не зчитували','Check Engine блимає','Check Engine горить постійно']}
};
const detectors:[Signal,RegExp][]=[
 ['engine_knock',/(?:стук|стуч|цок|брязк|тарах|грох).{0,40}(?:двигун|двигател|мотор)|(?:двигун|двигател|мотор).{0,40}(?:стук|стуч|цок|брязк|тарах|грох)/u],
 ['bumps',/(?:стук|грюк|грим|грем|скрип|бряк|грох).{0,45}(?:ям|нерівн|неровн|кочк|лежач|підвіск|подвес)|(?:ям|нерівн|кочк|підвіск|подвес).{0,45}(?:стук|грюк|скрип|грем)/u],
 ['no_crank',/(?:не\s+(?:крут|прокруч)|(?:крут|прокруч)\S*.{0,12}(?:повільно|ледве)|(?:клац|щелк).{0,30}(?:запуск|стартер|завод)|(?:запуск|стартер|завод).{0,30}(?:клац|щелк))/u],
 ['starting_unknown',/не\s*(?:завод|запуск|запуст)|незавод/u],
 ['power',/не\s+(?:тягне|едет|їде|набира\S*\s+оберт)|(?:немає|нема|нет)\s+тяг|втрат\S*.{0,12}(?:тяг|потуж)|пропа\S*.{0,12}тяг|тупи\S*|провал\S*.{0,20}газ|(?:повільно|туго|важко).{0,35}(?:оберт|оборот|їде|розган|разгон)|(?:газ|педал).{0,45}(?:дума|затрим|реаг|повільн)/u],
 ['hard_start',/(?:погано|плохо|важко|тяжело|довго|долго).{0,15}(?:завод|запуск|крут)|(?:завод|запуск).{0,15}(?:погано|плохо|важко|довго)/u],
 ['transmission',/(?:оберт|оборот).{0,30}(?:рост|зрост|підніма|повыш|набира).{0,35}(?:не\s+(?:їде|едет|прискор|розган)|швидк\S*.{0,12}(?:ні|не))|буксу\S*|пробуксов|(?:коробк|кпп|акпп).{0,25}(?:ривк|пина|штовх|затрим)/u],
 ['rough',/тро[їи]|перебо|пропуск\S*.{0,12}запал|нерівн\S*.{0,15}(?:прац|холост)|плава\S*.{0,15}(?:оберт|оборот)|(?:вібра|тряс|трус).{0,25}(?:двигун|мотор|холост)|смика|дерга|глохн/u],
 ['check_engine',/(?:check\s*engine|чек|check|чекенджин).{0,20}(?:гор|блим|світ|свет)|(?:гор|блим|світ).{0,20}(?:check\s*engine|чек)/u],
 ['brakes',/(?:гальм|тормоз).{0,35}(?:скрип|скрег|стук|вібра|б[иі]є|шум)|(?:скрип|скрег|стук|вібра|б[иі]є).{0,35}(?:гальм|тормоз)/u],
 ['cooling',/перегр[іе]в|кипит|закип|температур\S*.{0,15}(?:рост|зрост|висок|высок|червон)|гріється\s+(?:сильно|двигун)/u],
 ['oil',/(?:ламп|індик|давлен|тиск).{0,25}(?:олив|масл)|(?:олив|масл).{0,25}(?:тиск|давлен|ламп)/u],
 ['cabin',/(?:слаб|мало|не\s+дує|не\s+дме).{0,25}(?:повітр|пічк|печк|обдув)|(?:пічк|печк|вентиляц).{0,25}(?:слаб|запах|не\s+дує)/u],
 ['bearing',/(?:гул|гуд|виє|воет).{0,35}(?:колес|швидк|скорост|їзд|рух)|(?:колес|швидк|скорост).{0,35}(?:гул|гуд|виє)/u],
 ['steering',/(?:стук|клац|хруст|щелк|скрип).{0,35}(?:поворот|керм|рул)|(?:поворот|керм|рул).{0,35}(?:стук|клац|хруст|скрип)/u],
 ['charging',/(?:ламп|індик|значок).{0,25}(?:акум|батар)|(?:не\s+заряд|немає\s+заряд|нет\s+заряд)/u],
 ['aircon',/(?:кондиц|клімат|климат).{0,35}(?:не\s+(?:холод|охолод|прац)|тепл|гаряч|т[её]пл)|(?:не\s+холод|тепл\S*\s+повітр).{0,25}(?:кондиц|клімат)/u],
 ['cold_engine',/не\s+прогрі|довго\s+(?:грі|прогрі)|температур\S*.{0,15}(?:пада|низьк|низк)/u],
 ['white_smoke',/(?:біл|бел)\S*\s+(?:дим|вихлоп)|(?:дим|вихлоп).{0,15}(?:біл|бел)/u],
 ['blue_smoke',/(?:син|сиз)\S*\s+(?:дим|вихлоп)|(?:дим|вихлоп).{0,15}(?:син|сиз)/u],
 ['black_smoke',/(?:чорн|черн)\S*\s+(?:дим|вихлоп)|(?:дим|вихлоп).{0,15}(?:чорн|черн)/u]
];
function negated(signal:Signal,text:string){
 if(['starting_unknown','no_crank','power','aircon','cold_engine'].includes(signal))return false;
 if(signal==='oil'||signal==='charging'||signal==='check_engine')return /(?:не\s+гор|не\s+світ|не\s+свет|не\s+блим|немає|нема|нет)/u.test(text);
 if(signal.endsWith('_smoke'))return /(?:диму|дым\S*)\s+(?:немає|нема|нет)|не\s+дим/u.test(text);
 if(['engine_knock','bumps','steering','brakes'].includes(signal))return /не\s+(?:стук|стуч|скрип|грим|грем|клац)|(?:стуку|шуму)\s+немає/u.test(text);
 return /не\s+(?:тро|глох|гуд)|(?:гулу|перебоїв)\s+немає/u.test(text);
}
export function analyzeConversation(input:{vehicle:string;symptoms:string;history?:Message[];questionId?:string}){
 const history=input.history||[],users=[input.symptoms,...history.filter(m=>m.role==='user').map(m=>m.content)],latest=users.at(-1)||input.symptoms;
 const normalized=users.map(normalizeSymptoms),last=normalizeSymptoms(latest);
 const lastQuestion=[...history].reverse().find(m=>m.role==='assistant')?.content||'';
 const questionId=input.questionId||Object.values(questions).find(q=>lastQuestion.includes(q.text))?.id;
 const contexts:(string|undefined)[]=[undefined];let pending:string|undefined;
 for(const message of history){if(message.role==='assistant')pending=Object.values(questions).find(q=>message.content.includes(q.text))?.id;else{contexts.push(pending);pending=undefined;}}
 if(input.questionId&&contexts.length>1)contexts[contexts.length-1]=input.questionId;
 const facts=new Map<Signal,string>();
 for(let i=0;i<users.length;i++){
  for(const clause of normalized[i].split(/[.!?;\n]+|,\s*(?:але|но)\s+/u))for(const [signal,pattern] of detectors){if(pattern.test(clause)){if(negated(signal,clause))facts.delete(signal);else facts.set(signal,users[i]);}}
  if(/(?:не\s+двигун|не\s+мотор|двигун\s+не\s+стук)/u.test(normalized[i]))facts.delete('engine_knock');
  const value=normalized[i],context=contexts[i];
  const cranks=/(?:крутить|крутит|круте|прокручується|прокручивает)|(?:крут|прокруч).{0,20}(?:нормаль|добре|бадьоро)|(?:нормаль|добре).{0,15}(?:крут|прокруч)/u.test(value)||(context==='starting'&&/нормаль|добре|бадьоро|швидко/u.test(value));
  if(cranks&&!/не\s+крут|повільно/u.test(value)&&(facts.has('starting_unknown')||facts.has('no_crank')||facts.has('crank_no_start'))){facts.delete('no_crank');facts.delete('starting_unknown');facts.set('crank_no_start',users[i]);}
  if(context==='starting'&&/повільно|ледве|клац|не\s+крут/u.test(value)){facts.delete('crank_no_start');facts.delete('starting_unknown');facts.set('no_crank',users[i]);}
  if(context==='knock_location'){
   if(/ям|нерівн|кочк/u.test(value))facts.set('bumps',users[i]);
   else if(/двигун|мотор/u.test(value)&&!/(?:не\s+двигун|не\s+мотор)/u.test(value))facts.set('engine_knock',users[i]);
   else if(/поворот|керм|рул/u.test(value))facts.set('steering',users[i]);
  }
  if(context==='smoke'&&!/немає|нема|нет|не\s+дим/u.test(value)){if(/чорн|черн/u.test(value))facts.set('black_smoke',users[i]);if(/син|сиз/u.test(value))facts.set('blue_smoke',users[i]);if(/біл|бел/u.test(value))facts.set('white_smoke',users[i]);}
  if(context==='power'&&/оберт|оборот/u.test(value)&&/рост|зрост|підніма/u.test(value)&&/швидк|не\s+їде|майже\s+ні/u.test(value)){facts.delete('power');facts.set('transmission',users[i]);}
  if(context==='power'&&/повільно|туго/u.test(value)){facts.delete('transmission');facts.set('power',users[i]);}
  if(/диму\s+(?:немає|нема|нет)|не\s+дим/u.test(value)){facts.delete('white_smoke');facts.delete('blue_smoke');facts.delete('black_smoke');}
  if(/(?:стуку|стуків|шуму)\s+(?:вже\s+)?(?:немає|нема|нет)|стук\s+(?:зник|исчез)/u.test(value)){facts.delete('engine_knock');facts.delete('bumps');facts.delete('steering');}
  if(/(?:заводиться\s+(?:добре|нормально)|тепер\s+заводиться)/u.test(value)){facts.delete('starting_unknown');facts.delete('no_crank');facts.delete('crank_no_start');}
  if(facts.has('no_crank')){facts.delete('starting_unknown');facts.delete('crank_no_start');}
 }
 const text=normalized.join('\n');
 const diesel=/дизел|diesel|\btdi\b|\bcdi\b|\bhdi\b|\bdci\b/i.test(input.vehicle);
 const electric=/електр|electric|\bbev\b/i.test(input.vehicle)&&!/гібрид|hybrid/i.test(input.vehicle);
 let causes:DiagnosticCause[]=[];
 for(const [signal,evidence] of facts){if(signal==='starting_unknown')continue;const list=signal in extra?extra[signal as Extra]:guides[signal as keyof typeof guides];for(const item of list){if(diesel&&/Свічки або котушки запалювання/.test(item.title))continue;if(electric&&/пального|Свічки або котушки|колінчастого|змащення|Клапанний|впуск/u.test(item.title))continue;if(causes.some(c=>c.title===item.title))continue;causes.push({...item,evidence});}}
 if(facts.has('transmission')&&!/повільно.{0,20}оберт/u.test(last))causes=causes.filter(c=>!guides.power.some(e=>e.title===c.title));
 causes=causes.slice(0,7);
 const asked=history.filter(m=>m.role==='assistant').map(m=>m.content).join('\n');let next:Question|undefined;
 if(facts.has('starting_unknown'))next=questions.starting;
 else if(facts.has('power')&&!/(?:повільно|туго|важко).{0,30}(?:оберт|оборот)|(?:оберт|оборот).{0,30}(?:повільно|туго)/u.test(text))next=questions.power;
 else if(facts.has('engine_knock')&&!/холод|гаряч|прогр/u.test(text))next=questions.engine_temperature;
 else if(facts.has('check_engine')&&!/(?:p\d{4}|код|сканер|зчит|счит)/iu.test(text))next=questions.codes;
 else if(!facts.size&&/(?:стук|стуч|грим|скрип)/u.test(last)&&!/(?:не\s+стук|не\s+стуч)/u.test(last))next=questions.knock_location;
 else if(!facts.size&&/дим|дым/u.test(last)&&!/(?:немає|нема|нет)/u.test(last))next=questions.smoke;
 else if(!facts.size&&!/(?:не\s+стук|немає|нема|нет|дякую|спасиб)/u.test(last))next=questions.generic;
 if(next&&(asked.includes(next.text)||questionId===next.id)){
  if(next.id==='starting'&&facts.has('starting_unknown')&&!asked.includes('Оберіть поведінку стартера'))next={...questions.starting,text:'Оберіть поведінку стартера під час спроби запуску — це потрібно для вибору перевірок.'};
  else next=undefined;
 }
 let note=causes.length?'За вашим описом варто перевірити:\n\n'+causes.slice(0,4).map((c,i)=>`${i+1}. ${c.title}. ${c.explanation}`).join('\n\n')+'\n\nСпочатку виконайте перевірки нижче — купувати деталь до підтвердження причини зарано.':facts.has('starting_unknown')?'Незапуск має дві різні гілки: стартер не прокручує двигун або двигун прокручується, але не запускається. Одна відповідь нижче допоможе вибрати потрібні перевірки.':next?.id==='knock_location'?'Стук може походити від двигуна, підвіски або кермового механізму. Важливо визначити, коли й де його чути.':next?.id==='smoke'?'Колір і момент появи вихлопу допоможуть відрізнити конденсат від несправності.':'У цьому повідомленні не визначено конкретного симптому. Можна описати зміну в роботі авто або результати перевірки.';
 if(facts.has('oil')||facts.has('engine_knock'))note='Якщо стук сильний і новий або горить лампа тиску оливи, зупиніть авто й заглушіть двигун.\n\n'+note;
 if(history.some(m=>m.role==='user'))note='Врахував ваше уточнення: «'+latest+'».\n\n'+note;
 if(/дякую|спасиб/u.test(last)){note='Будь ласка. Якщо з’являться нові симптоми або результати діагностики, напишіть їх тут.';next=undefined;}
 return {causes,questions:next?[next.text]:[],questionId:next?.id||'',choices:next?.choices||[],note,method:'guided',recognized:[...facts.keys()],normalizedProblem:correctDescription(input.symptoms),hasCorrection:false};
}
