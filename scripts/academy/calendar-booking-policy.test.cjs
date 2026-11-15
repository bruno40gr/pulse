/* eslint-disable @typescript-eslint/no-require-imports -- Offline domain verification. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function load(file) {
  const exports = {}
  const requireLocal = name => {
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name)
    const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)
    return load(['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(candidate)))
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: requireLocal, Response, URL, crypto: require('node:crypto').webcrypto })
  return exports
}

const booking = load(path.join(root, 'beta-source/lib/academy-calendar-booking.ts'))
const policy = load(path.join(root, 'beta-source/lib/academy-scheduling-policy.ts'))
function fixture() {
  const setup = { teachers: [{ id: 't', values: { name: 'Teacher', location: 'l', assignments: '[{"serviceId":"p"}]', availability: JSON.stringify(Array.from({length:7}, (_, day) => ({id:String(day), day, from:540, to:1260}))) } }], locations: [{ id: 'l', values: {name:'School'}, rooms: [{ id:'r', name:'Room', capacity:'4', allServices:true, serviceIds:[] }] }], services:[{id:'p', values:{name:'Piano'}}], policies:[{id:'policy', values:{}}] }
  const data = { students:[{id:'s', firstName:'Student', lastName:'One', enrollments:[]}], lessons:[], accounts:[{id:'a', holderId:'h', studentIds:['s']}], cards:[], invoices:[] }
  const draft = { id:'new', kind:'studio', title:'Space', date:'2026-11-04', time:'12:00', duration:60, teacherId:'', roomId:'r', serviceId:'p', studentIds:[], groupId:'', repeat:'once', until:'2026-11-04', publicOnly:false, status:'Scheduled' }
  return { context:{setup, data, groups:[], occurrences:[]}, draft }
}
test('non-enrollment room booking persists with no student or enrollment', () => {
 const {context,draft}=fixture(); const next=booking.saveCalendarBooking(context,draft)
 assert.equal(next.calendarBookings.length,1); assert.equal(next.students[0].enrollments.length,0); assert.equal(next.calendarBookings[0].roomName,'Room')
})
test('lesson requires one student and only 30/60 minutes', () => {
 const {context,draft}=fixture(); const lesson={...draft,kind:'lesson',teacherId:'t'}
 assert.match(booking.bookingReason(context,lesson), /one student/)
 assert.match(booking.bookingReason(context,{...lesson,studentIds:['s'],duration:90}), /30- or 60/)
 assert.equal(booking.bookingReason(context,{...lesson,studentIds:['s']}),null)
})
test('hard blocks apply for whole duration independently of overlays', () => {
 const {context,draft}=fixture(); context.setup.resourceBlocks=[{id:'hard',values:{booking:JSON.stringify({...draft,id:'hard',kind:'block',time:'12:30',duration:30})}}]
 assert.match(booking.bookingReason(context,draft),/blocked/)
 assert.equal(booking.bookingReason(context,{...draft,time:'11:30'}),null)
})
test('public veto windows do not block staff', () => {
 const {context,draft}=fixture(); context.setup.resourceBlocks=[{id:'veto',values:{booking:JSON.stringify({...draft,id:'veto',kind:'block',publicOnly:true})}}]
 assert.equal(booking.bookingReason(context,draft),null)
 assert.match(booking.bookingReason({...context,audience:'public'},draft),/blocked/)
})
test('availability includes time off and date-specific hours for entire lesson', () => {
 const {context,draft}=fixture(); const lesson={...draft,kind:'lesson',teacherId:'t',studentIds:['s']}
 context.setup.teachers[0].values.timeOff=JSON.stringify([{id:'off',start:draft.date,end:draft.date,allDay:false,from:750,to:780}])
 assert.match(booking.bookingReason(context,lesson),/unavailable/)
 assert.equal(booking.bookingReason(context,{...lesson,time:'13:00'}),null)
 context.setup.teachers[0].values.availabilityOverrides=JSON.stringify([{date:draft.date,blocks:[]}])
 assert.match(booking.bookingReason(context,{...lesson,time:'13:00'}),/unavailable/)
})
test('room exclusivity is independent of room capacity', () => {
 const {context,draft}=fixture(); context.occurrences=[{id:'existing',date:draft.date,start:'12:30',end:'13:30',kind:'studio',status:'Scheduled',room:'Room',studentIds:[]}]
 assert.match(booking.bookingReason(context,draft),/exclusive/)
})
test('band roster snapshot consumes one room and checks capacity/participants', () => {
 const {context,draft}=fixture(); context.groups=[{id:'g',memberIds:['s']}]
 const next=booking.saveCalendarBooking(context,{...draft,kind:'rehearsal',groupId:'g'})
 assert.equal(next.calendarBookings.length,1); assert.deepEqual(Array.from(next.calendarBookings[0].studentIds),['s'])
 context.setup.locations[0].rooms[0].capacity='0'
 assert.match(booking.bookingReason(context,{...draft,groupId:'g'}),/capacity/)
})
test('ten-minute breaks reserve thirty minutes after four teaching hours', () => {
 const rules=policy.readSchedulingPolicy(); assert.equal(rules.restMinutes,30)
 const existing=[{time:'09:00',duration:60},{time:'10:00',duration:60},{time:'11:00',duration:60},{time:'12:00',duration:60}]
 assert.match(policy.teachingPolicyReason(existing,'13:00',30,rules), /30-minute/)
 assert.equal(policy.teachingPolicyReason(existing,'13:30',30,rules),null)
})
test('a rest gap must contain a whole half-hour slot, not only 30 elapsed minutes', () => {
 const rules=policy.readSchedulingPolicy()
 assert.match(policy.teachingPolicyReason([{time:'09:45',duration:240}], '14:00',30,rules), /30-minute/)
 assert.equal(policy.teachingPolicyReason([{time:'09:45',duration:240}], '14:00',30,{...rules,teachingLimit:300}),null)
})
test('max gaps do not accidentally merge separate explicit availability shifts', () => {
 const {context,draft}=fixture(); context.setup.teachers[0].values.availabilityOverrides=JSON.stringify([{date:draft.date,blocks:[{id:'am',day:2,from:540,to:720},{id:'pm',day:2,from:1020,to:1260}]}])
 context.occurrences=[{id:'am',kind:'lesson',status:'Scheduled',date:draft.date,start:'10:00',end:'11:00',teacherId:'t',room:'Other',studentIds:[]}]
 assert.equal(booking.bookingReason(context,{...draft,kind:'lesson',teacherId:'t',studentIds:['s'],time:'17:00'}),null)
 assert.match(policy.teachingPolicyReason([{time:'09:00',duration:30}], '14:00',30,policy.readSchedulingPolicy()),/gap longer/)
})
test('weekly hard blocks check every date and never silently displace existing bookings', () => {
 const {context,draft}=fixture(); context.data.calendarBookings=[{...draft,id:'existing',date:'2026-11-11'}]
 assert.throws(()=>booking.saveCalendarBooking(context,{...draft,kind:'block',repeat:'weekly',until:'2026-11-18'}), /2026-11-11.*exclusive/)
 assert.equal(context.data.calendarBookings.length,1)
})
test('public hours cannot open empty teacher days and empty days require explicit hours', () => {
 const {context,draft}=fixture(); context.setup.teachers[0].values.availability='[]'
 assert.match(booking.bookingReason({...context,audience:'public'},{...draft,kind:'lesson',teacherId:'t',studentIds:['s']}),/unavailable/)
 context.setup.policies[0].values.publicFrom='14:00'; context.setup.policies[0].values.publicTo='18:00'
 assert.match(booking.bookingReason({...context,audience:'public'},draft),/not offered/)
 assert.equal(booking.bookingReason(context,draft),null)
})
test('invalid half-hour times and missing resource blocks are rejected', () => {
 const {context,draft}=fixture()
 assert.match(booking.bookingReason(context,{...draft,time:'12:10'}),/30-minute/)
 assert.match(booking.bookingReason(context,{...draft,kind:'block',roomId:''}),/teacher or room/)
})
test('calendar lessons require enrollment rather than creating a zero-price booking', () => {
 const {context,draft}=fixture()
 assert.throws(() => booking.saveCalendarBooking(context,{...draft,kind:'lesson',teacherId:'t',studentIds:['s']}), /Continue to enrollment/)
 assert.equal(context.data.lessons.length,0)
})
test('mock configuration migration is additive, preserves overrides, and runs only once', () => {
 const {upgradeDemoBookingSetup}=load(path.join(root,'beta-source/lib/odeon-demo-setup.ts'))
 const {context}=fixture(); context.setup.policies[0].values.maxTeachingGap='90'
 const next=upgradeDemoBookingSetup(context.setup)
 assert.equal(next.policies[0].values.maxTeachingGap,'90')
 assert.equal(next.services[0].id,'p')
 assert.equal(next.services.length,4)
 const changed={...next,services:next.services.filter(item=>item.id!=='demo-event-space')}
 assert.equal(upgradeDemoBookingSetup(changed),changed)
})

const enrollment = load(path.join(root, 'beta-source/lib/academy-calendar-enrollment.ts'))
const { createPortalQueue } = load(path.join(root, 'beta-source/lib/academy-portal-queue.ts'))
const { enrollmentTeachers } = load(path.join(root, 'beta-source/lib/academy-staff-enrollment.ts'))
function enrollmentFixture(sent = false, arrangement = 'À-la-carte') {
 const {context,draft}=fixture()
 context.setup.teachers[0].values.name=enrollmentTeachers[0]
 context.data.accounts[0]={...context.data.accounts[0], name:'One', holderName:'Parent One', email:'parent@example.test'}
 context.data.students[0].family=[]
 const queue=createPortalQueue(context.data)
 const proposal={...draft,kind:'lesson',teacherId:'t',studentIds:['s'],arrangement}
 const result=enrollment.createCalendarEnrollment(queue,context,proposal,sent)
 const record=result.queue.drafts[0].data
 record.draft.payment='later'
 return {context,proposal,queue:result.queue,record}
}
test('calendar proposal opens normal first step with linked payer and exact prefills; retry/send/resend keeps one draft', () => {
 const {context,proposal,queue,record}=enrollmentFixture()
 assert.equal(record.step,0); assert.equal(record.reviewedSteps.length,0)
 assert.equal(record.draft.manager.id,'h'); assert.equal(record.draft.student.id,'s')
 assert.equal(record.draft.lessons[0].roomId,'r'); assert.equal(record.draft.lessons[0].time,'12:00')
 assert.equal(record.draft.lessons[0].frequency,'À-la-carte')
 const retry=enrollment.createCalendarEnrollment(queue,context,proposal,true).queue
 assert.equal(retry.drafts.length,1)
 assert.equal(enrollment.sendCalendarEnrollment(retry,proposal.id),retry)
 assert.equal(context.data.lessons.length,0)
 assert.throws(()=>enrollment.calendarWorkflow(retry,proposal.id,'other'),/unavailable/)
})
test('staff and family share completion identity, result links, pricing and unpaid status', () => {
 for(const actor of ['staff','family']) {
 const {context,queue,record}=enrollmentFixture(true)
 const result=enrollment.saveCalendarEnrollment(queue,context,record,true,actor,'a')
 const saved=result.queue.drafts[0].data
 assert.ok(saved.completedAt); assert.equal(saved.calendarRequest.completedBy,actor)
 assert.equal(saved.calendarRequest.enrollmentIds.length,1)
 const subscription=result.data.students[0].enrollments[0]
 assert.equal(subscription.amountMinor,10000); assert.equal(subscription.initialPaymentStatus,'unpaid')
 assert.equal(subscription.serviceId,'p'); assert.equal(subscription.payerId,'h')
 assert.equal(result.data.lessons[0].room,'Room'); assert.equal(result.data.lessons.length,1)
 assert.throws(()=>enrollment.saveCalendarEnrollment(result.queue,{...context,data:result.data},record,true,actor,'a'),/already been completed/)
 assert.throws(()=>enrollment.sendCalendarEnrollment(result.queue,record.id),/already been completed/)
 }
})
test('paid ongoing subscription reuses per-lesson price and honors accepted duplicate subscription', () => {
 const {context,queue,record}=enrollmentFixture(true,'Monthly subscription')
 const existing={id:'existing',program:'Piano',serviceId:'p',frequency:'Weekly',status:'active',teacher:'Other',time:'09:00',day:'Monday',start:'2026-11-01',duration:30}
 context.data.students[0].enrollments.push(existing)
 const review=enrollment.saveCalendarEnrollment
 assert.throws(()=>review(queue,context,record,true,'staff','a'),/created elsewhere/)
 assert.throws(()=>review(queue,context,record,true,'family','a',true),/created elsewhere/)
 record.draft.payment='demo_card'
 const result=review(queue,context,record,true,'staff','a',true)
 const added=result.data.students[0].enrollments.find(item=>item.id!=='existing')
 assert.equal(added.frequency,'Weekly'); assert.equal(added.initialPaymentStatus,'paid'); assert.equal(added.priceUnit,'per lesson')
 assert.equal(result.data.students[0].enrollments.length,2)
})
test('completion rechecks current room/teacher availability and never marks failed draft complete', () => {
 const {context,proposal,queue,record}=enrollmentFixture(true)
 context.data=booking.saveCalendarBooking(context,{...proposal,id:'occupied',kind:'studio',teacherId:'',studentIds:[]})
 assert.throws(()=>enrollment.saveCalendarEnrollment(queue,context,record,true,'family','a'),/2026-11-04/)
 assert.equal(queue.drafts[0].data.completedAt,undefined)
})
test('family saves cannot move draft to another family and preserve request identity', () => {
 const {context,queue,record}=enrollmentFixture(true)
 assert.throws(()=>enrollment.saveCalendarEnrollment(queue,context,record,false,'family','other'),/unavailable/)
 const bad={...record,draft:{...record.draft,student:{...record.draft.student,id:'outsider'}}}
 assert.throws(()=>enrollment.saveCalendarEnrollment(queue,context,bad,false,'family','a'),/does not match/)
 const next=enrollment.saveCalendarEnrollment(queue,context,{...record,step:1},false,'family','a')
 assert.equal(next.queue.drafts[0].id,record.id); assert.equal(next.queue.drafts[0].data.step,1)
})

test('additional payer details survive completion without changing family identity', () => {
 const {context,queue,record}=enrollmentFixture(true)
 record.draft.payer='other'; record.draft.otherPayer={name:'Sponsor One',email:'sponsor@example.test',phone:''}
 const result=enrollment.saveCalendarEnrollment(queue,context,record,true,'family','a')
 const added=result.data.students[0].enrollments[0]
 assert.equal(added.payerDetails.name,'Sponsor One'); assert.match(added.payerId,/^payer:/)
 assert.equal(result.data.accounts[0].holderId,'h')
})
const {calendarBookingOptions,reconcileCalendarBooking}=load(path.join(root,'beta-source/lib/academy-calendar-options.ts'))
test('resource choices hide incompatible services, teachers and rooms and select the first available room',()=>{
 const {context,draft}=fixture()
 context.setup.services.push({id:'g',values:{name:'Guitar'}})
 context.setup.teachers.push({id:'guitar',values:{...context.setup.teachers[0].values,name:'Guitar teacher',assignments:'[{"serviceId":"g"}]'}})
 context.setup.locations[0].rooms.unshift({id:'guitar-room',name:'Guitar room',capacity:'4',allServices:false,serviceIds:['g']})
 const lesson={...draft,kind:'lesson',teacherId:'t',serviceId:'p',roomId:'',studentIds:['s']}
 const options=calendarBookingOptions(context,lesson)
 assert.equal(options.teachers.map(item=>item.id).join(','),'t')
 assert.equal(options.services.map(item=>item.id).join(','),'p')
 assert.equal(options.rooms.map(item=>item.id).join(','),'r')
 assert.equal(reconcileCalendarBooking(context,lesson).roomId,'r')
 const changed=reconcileCalendarBooking(context,{...lesson,serviceId:'g'})
 assert.equal(changed.teacherId,''); assert.equal(changed.roomId,'guitar-room')
})
test('resource choices recheck changed date against persisted occupancy even outside visible calendar week',()=>{
 const {context,draft}=fixture()
 context.data=booking.saveCalendarBooking(context,{...draft,id:'busy',date:'2026-11-11',until:'2026-11-11'})
 assert.equal(calendarBookingOptions(context,{...draft,date:'2026-11-11'}).rooms.length,0)
 assert.equal(reconcileCalendarBooking(context,{...draft,date:'2026-11-11'}).roomId,'')
})
test('non-lesson reservations need no service, blocks stay hard and blank date cannot crash option calculation',()=>{
 const {context,draft}=fixture()
 assert.equal(booking.bookingReason(context,{...draft,serviceId:''}),null)
 assert.equal(reconcileCalendarBooking(context,{...draft,kind:'block',publicOnly:true}).publicOnly,false)
 assert.doesNotThrow(()=>calendarBookingOptions(context,{...draft,date:''}))
})

test('rehearsals and events require explicit room activities and planned capacity', () => {
 const {context,draft}=fixture()
 const room=context.setup.locations[0].rooms[0]
 room.allServices=false;room.serviceIds=['p']
 context.setup.services.push({id:'rh',values:{name:'Rehearsal',bookingKind:'rehearsal'}},{id:'ev',values:{name:'Event',bookingKind:'event'}})
 assert.match(booking.bookingReason(context,{...draft,kind:'rehearsal',serviceId:''}),/not configured/)
 room.serviceIds.push('rh','ev')
 assert.equal(booking.bookingReason(context,{...draft,kind:'rehearsal',serviceId:''}),null)
 assert.match(booking.bookingReason(context,{...draft,kind:'event',requiredCapacity:8}),/capacity/)
 assert.equal(calendarBookingOptions(context,{...draft,kind:'event',requiredCapacity:8}).rooms.length,0)
 assert.equal(booking.bookingReason(context,{...draft,kind:'event',requiredCapacity:4}),null)
 assert.match(booking.bookingReason(context,{...draft,kind:'event'}),/required event capacity/)
})
test('small rooms reject group services at configured capacity, not current roster size', () => {
 const {context,draft}=fixture()
 context.setup.services[0].values={name:'Group Piano',formats:'["group"]',capacity:'8'}
 const lesson={...draft,kind:'lesson',teacherId:'t',studentIds:['s']}
 assert.match(booking.bookingReason(context,lesson),/capacity/)
 assert.equal(calendarBookingOptions(context,lesson).services.length,0)
 context.setup.services[0].values.capacity='2'
 assert.equal(booking.bookingReason(context,lesson),null)
})
test('calendar constraints preserve clicked resources when the time becomes unavailable', () => {
 const {context,draft}=fixture()
 const lesson={...draft,kind:'lesson',teacherId:'t',studentIds:['s'],time:'06:00'}
 const constraints={teacherId:'t',roomId:'r',serviceId:'p'}
 const result=reconcileCalendarBooking(context,lesson,constraints)
 assert.equal(result.teacherId,'t');assert.equal(result.roomId,'r');assert.equal(result.serviceId,'p')
 assert.match(booking.bookingReason(context,result),/unavailable/)
})
test('teacher and room context limit available lesson services', () => {
 const {context,draft}=fixture()
 context.setup.services.push({id:'other',values:{name:'Other'}})
 context.setup.teachers.push({...context.setup.teachers[0],id:'other',values:{...context.setup.teachers[0].values,assignments:'[{"serviceId":"other"}]'}})
 const result=calendarBookingOptions(context,{...draft,kind:'lesson',serviceId:'',teacherId:'t'}, {teacherId:'t',roomId:'r'})
 assert.deepEqual(Array.from(result.services,service=>service.id),['p'])
})

test('teaching and rest settings cannot override the fixed school rules', () => {
 const rules=policy.readSchedulingPolicy({teachingBeforeBreak:'360',restBreakMinutes:'60'},{teachingBeforeBreak:'120',restBreakMinutes:'30'})
 assert.equal(rules.teachingLimit,240)
 assert.equal(rules.restMinutes,30)
 assert.equal(policy.readSchedulingPolicy({publicBooking:'no'}).publicEnabled,false)
 assert.equal(policy.readSchedulingPolicy({publicBooking:'no'},{publicBooking:'yes'}).publicEnabled,true)
})

test('staff duty requires explicit capability and location, never app permissions or students', () => {
 const {context,draft}=fixture(); const duty={...draft,kind:'front-desk',teacherId:'t',roomId:'',serviceId:'',locationId:'l'}
 assert.match(booking.bookingReason(context,duty),/eligible/)
 context.setup.teachers[0].values.canCoverFrontDesk='yes'
 assert.equal(booking.bookingReason(context,duty),null)
 assert.match(booking.bookingReason(context,{...duty,kind:'admin'}),/eligible/)
 context.setup.teachers[0].values.canPerformAdmin='yes'
 assert.equal(booking.bookingReason(context,{...duty,kind:'admin'}),null)
 assert.match(booking.bookingReason(context,{...duty,locationId:''}),/location/)
 assert.match(booking.bookingReason(context,{...duty,studentIds:['s']}),/participants/)
 assert.match(booking.bookingReason({...context,audience:'public'},duty),/internal/)
})
test('recurring duty prevents teaching and other duties even without visible occurrences and releases on cancellation', () => {
 const {context,draft}=fixture(); context.setup.teachers[0].values.canCoverFrontDesk='yes'; context.setup.teachers[0].values.canPerformAdmin='yes'
 const duty={...draft,kind:'front-desk',teacherId:'t',roomId:'',serviceId:'',locationId:'l',repeat:'weekly',until:'2026-11-18'}
 const data=booking.saveCalendarBooking(context,duty)
 assert.equal(data.calendarBookings[0].title,'Front desk'); assert.equal(data.calendarBookings[0].roomId,'')
 const lesson={...draft,id:'lesson',date:'2026-11-11',kind:'lesson',teacherId:'t',studentIds:['s']}
 assert.match(booking.bookingReason({...context,data},lesson),/duty/)
 assert.match(booking.bookingReason({...context,data},{...duty,id:'other',kind:'admin'}),/duty/)
 const released={...data,calendarBookings:data.calendarBookings.map(item=>({...item,status:'Cancelled'}))}
 assert.equal(booking.bookingReason({...context,data:released},lesson),null)
})
test('weekly duty validates every occurrence against time off and existing bookings', () => {
 const {context,draft}=fixture(); context.setup.teachers[0].values.canPerformAdmin='yes'
 context.setup.teachers[0].values.timeOff=JSON.stringify([{id:'off',start:'2026-11-11',end:'2026-11-11',allDay:true}])
 const duty={...draft,kind:'admin',teacherId:'t',roomId:'',serviceId:'',locationId:'l',repeat:'weekly',until:'2026-11-18'}
 assert.throws(()=>booking.saveCalendarBooking(context,duty),/2026-11-11.*unavailable/)
 context.setup.teachers[0].values.timeOff='[]'
 const occupied=booking.saveCalendarBooking(context,{...draft,id:'existing',teacherId:'t',date:'2026-11-11'})
 assert.throws(()=>booking.saveCalendarBooking({...context,data:occupied},duty),/2026-11-11.*booking/)
})
