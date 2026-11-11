"""Recover the original progress menu's particle layers and animation drivers."""
import copy
import hashlib
from particle_lighting import numeric

HOST='engine/ui/progress/progress.gc'
PART='engine/ui/progress/progress-part.gc'
SOURCES=(HOST,PART,'engine/ui/progress/progress-draw.gc','engine/ui/progress/progress-h.gc',
         'engine/ui/progress/progress-static.gc','engine/gfx/hw/video.gc','engine/gfx/sprite/sprite.gc',
         'engine/gfx/math-camera.gc','engine/math/trigonometry.gc','engine/common-obs/generic-obs.gc')


def extract_progress_hud(root,parse,walk):
    if not (root/HOST).exists():return None
    hostfile,partfile=HOST,PART
    texts={file:(root/file).read_text() for file in SOURCES}
    forms={file:parse(text) for file,text in texts.items()}
    def unique(file,kind,name):
        matches=[f for f in forms[file] if f[:2]==[kind,name]]
        if len(matches)!=1:raise ValueError('Expected unique '+name)
        return matches[0]


    def original(value):
        if isinstance(value,list) and value[:1]==['#if']:
            if value[1]!='PC_PORT':raise ValueError('Unknown source platform condition')
            return original(value[3])
        if isinstance(value,list) and value[:1]==['meters'] and len(value)==2:
            return 4096*numeric(value[1])
        return numeric(value)


    initial=unique(partfile,'defmethod','initialize-particles')
    layers=[]
    for form in initial[3:]:
        if not isinstance(form,list) or form[:1]!=['progress-new-particle']:continue
        keys=dict(zip(form[1::2],form[2::2]))
        if set(keys)!={':part',':x',':y',':z'}:raise ValueError('Unknown layer shape')
        layers.append({'group':original(keys[':part']),'position':[original(keys[':'+k]) for k in 'xyz'],
                       'source':{'file':partfile,'line':form.line}})
    assert len(layers)==32
    init=unique(hostfile,'defbehavior','progress-init-by-other')
    initial_state={f[1][3]:original(f[2]) for f in init[4:]
        if isinstance(f,list) and f[:1]==['set!'] and f[1][:3]==['->','self','particle-state']}
    assert set(initial_state)==set(range(32))
    for index,layer in enumerate(layers):layer['state']=initial_state[index]
    ratios=unique(hostfile,'defmethod','adjust-ratios')
    case=next(f for f in ratios if isinstance(f,list) and f[:2]==['case','aspect'])
    profiles=[]
    for name,tag in [('4:3','aspect4x3'),('16:9','aspect16x9')]:
        clause=next(c for c in case[2:] if c[0]==[['quote',tag]])
        scales={f[1][2]:original(f[2]) for f in clause[1:] if f[:1]==['set!'] and f[1][:2]==['->','this'] and len(f[1])==3}
        assert set(scales)=={'sides-x-scale','sides-y-scale','left-x-offset','right-x-offset','button-scale','slot-scale','small-orb-y-offset','big-orb-y-offset'}
        profiles.append({'id':name,'scales':scales,'source':{'file':hostfile,'line':clause.line}})
    icon_init=unique(hostfile,'defmethod','initialize-icons')
    icons=[]
    for f in icon_init[3:]:
        if not isinstance(f,list) or f[:2]!=['progress-make-icon','this']:continue
        args=dict(zip(f[2::2],f[3::2]))
        if args[':skel']!='*fuelcell-naked-sg*':continue
        icons.append({'index':len(icons),'frame':0,'held':False,'yaw':None,'x':original(args[':x']),'y':original(args[':y']),
                      'z':original(args[':z']),'scaleX':original(args[':scale-x']),'scaleY':original(args[':scale-y'])})
    for f in icon_init[3:]:
        if isinstance(f,list) and f[:1]==['send-event'] and f[2]==['quote','set-frame-num']:
            assert f[1][0]=='ppointer->process' and f[1][1][:3]==['->','this','icons']
            icons[f[1][1][3]]['frame']=original(f[3])
            icons[f[1][1][3]]['held']=True
    assert len(icons)==4
    yaw=None
    for f in walk(init):
        if f[:1]==['quaternion-axis-angle!']:
            assert [original(v) for v in f[2:5]]==[0,1,0]
            yaw=original(f[5])
        elif f[:1]==['quaternion*!'] and f[1][:3]==['->','self','icons']:
            icons[f[1][3]]['yaw']=yaw
    assert all(icon['yaw'] is not None for icon in icons)
    states=[]
    for state in ['progress-coming-in','progress-going-out']:
        form=unique(hostfile,'defstate',state)
        states.append({'name':state,'source':{'file':hostfile,'line':form.line},
            'seekExpressions':[f for f in walk(form) if f[:1]==['seekl!']]})
    manipy=unique('engine/common-obs/generic-obs.gc','defstate','manipy-idle')
    held_event=next(f for f in walk(manipy) if f[:1]==[[['quote','set-frame-num']]])
    if not any(f[:1]==['set!'] and f[1][-1]=='num-func' and f[2]=='num-func-identity' for f in walk(held_event)):
        raise ValueError('Source held-frame event changed')
    names={f[f.index(':id')+1]:f[1] for f in forms[PART] if f[:1]==['defpartgroup']}
    for layer in layers:
        layer['groupId']=layer['group']
        layer['group']=names[layer['group']]
    for profile in profiles:profile['layers']=copy.deepcopy(layers)
    egg_form=unique('engine/ui/progress/progress-static.gc','define','*task-egg-starting-x*')
    eggs=egg_form[2][5:]
    if eggs!=[218,194,171,147,124,100,77,53,30]:raise ValueError('Unexpected progress task spacing table')
    maximum=next(original(f[2]) for f in init[4:] if isinstance(f,list) and f[:2]==['set!',['->','self','in-out-position']])
    if maximum!=4096:raise ValueError('Unexpected progress offset range')
    rates={}
    for item,key,target in zip(states,('arrival','departure'),(0,maximum)):
        seeks=[f for f in item['seekExpressions'] if f[1]==['->','self','in-out-position']]
        if len(seeks)!=1 or seeks[0][2]!=target or seeks[0][3]!=['the','int',['*',170.0,['->','*display*','time-adjust-ratio']]]:
            raise ValueError('Unexpected progress outer seek rate')
        rates[key]=original(seeks[0][3][2][1])
    speed=unique(HOST,'defmethod','set-transition-speed!')
    assigned=[original(f[2]) for f in walk(speed) if f[:2]==['set!',['->','this','transition-speed']]]
    if assigned!=[15,45]:raise ValueError('Unexpected progress transition rates')
    arrival=unique(HOST,'defstate','progress-coming-in')
    departure=unique(HOST,'defstate','progress-going-out')
    arrival_tests=[f[1] for f in walk(arrival) if f[:1]==['when']]
    departure_tests=[f[1] for f in walk(departure) if f[:1]==['when']]
    if arrival_tests!=[['<',['->','self','in-out-position'],2867]]:
        raise ValueError('Unexpected progress arrival threshold')
    if departure_tests!=[['<',153,['->','self','transition-offset']]]:
        raise ValueError('Unexpected progress departure threshold')
    transition_seeks=[f for f in walk(departure) if f[:2]==['seekl!',['->','self','transition-offset']]]
    if len(transition_seeks)!=1 or transition_seeks[0][2:]!=[512,['the','int',['*',['->','self','transition-speed'],['->','*display*','time-adjust-ratio']]]]:
        raise ValueError('Unexpected progress transition range')
    save_rates=[original(f[2]) for f in walk(departure) if f[:2]==['set!',['->','self','transition-speed']]]
    if save_rates!=[30]:raise ValueError('Unexpected progress save departure rate')
    rates.update(stats=assigned[0],other=assigned[1],saveDeparture=save_rates[0])
    # Fingerprint the complete source bodies as well as the extracted constants.
    callbacks=[{'name':f[1],'source':{'file':PART,'line':f.line},
                'formSha256':hashlib.sha256(repr(f).encode()).hexdigest()}
               for f in forms[PART] if f[:1]==['defun']]
    if len(callbacks)!=13:raise ValueError('Unexpected progress callback set')
    return {'id':'progress','name':'Progress menu particles','xSign':0,'ySign':0,
            'profiles':profiles,'states':[layer['state'] for layer in layers],
            'icons':icons,'model':'fuelcell-naked-lod0','clip':'fuelcell-naked-idle',
            'maximumOffset':maximum,'transitionMaximum':transition_seeks[0][2],'arrivalThreshold':arrival_tests[0][2],
            'departureThreshold':departure_tests[0][1],'rates':rates,'eggStartingX':eggs,
            'source':{'file':PART,'line':initial.line},'callbacks':callbacks,
            'sources':[{'file':file,'sha256':hashlib.sha256(text.encode()).hexdigest()} for file,text in texts.items()]}
