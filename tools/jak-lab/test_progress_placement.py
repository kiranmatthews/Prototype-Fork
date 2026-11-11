"""Evaluate original progress placement and transition bodies independently."""
import argparse
import copy
import json
import math
from pathlib import Path

from catalogue import parse,walk
from test_screen_hud import f32
from test_sun_particles import SourceMath

from test_progress_hud import ProgressGoal
from progress_hud import extract_progress_hud
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args();root=args.source
math_source=SourceMath(root)
font_ops={'draw-string-xy','print-game-text','print-game-text-scaled','lookup-text!','format','clear','string-format',
          'set-width!','set-height!','set-scale!','set-color!'}


class PlacementGoal(ProgressGoal):
    def run(self,form):
        if isinstance(form,str):
            if form in font_ops:return form
            if form.startswith('"'):return form[1:-1]
        if not isinstance(form,list):return super().run(form)
        if not form:return None
        op,*args=form
        if op in font_ops or (isinstance(op,str) and self.env.get(op) in font_ops):return None
        if op=='progress-screen':return screen_codes[args[0]]
        if op in ('font-color','font-flags','text-id','task-status'):return args[0]
        if op=='new' and args[1]==['quote','font-context']:
            return {'origin':dict(x=0.,y=0.,z=0.),'flags':0,'color':0}
        if op in ('+','-','*','/'):
            values=list(map(self.run,args))
            if len(values)==1:
                assert op=='-';return -values[0]
            value=values[0]
            for right in values[1:]:
                floating=isinstance(value,float) or isinstance(right,float)
                value=value+right if op=='+' else value-right if op=='-' else value*right if op=='*' else value/right
                value=f32(value) if floating else math.trunc(value)
            return value
        if op=='+!':
            right=self.run(args[1]);target=args[0]
            if isinstance(target,str):obj,key=self.env,target
            else:obj,key=self.ref(target)
            obj[key]=f32(obj[key]+right) if isinstance(obj[key],float) or isinstance(right,float) else obj[key]+right
            return obj[key]
        if op in ('>','<=','!='):
            a,b=map(self.run,args);return a>b if op=='>' else a<=b if op=='<=' else a!=b
        if op=='nonzero?':return self.run(args[0])!=0
        if op=='max':return max(map(self.run,args))
        if op=='1/':return f32(1/self.run(args[0]))
        if op=='mod':return self.run(args[0])%self.run(args[1])
        if op=='length':return len(self.run(args[0]))
        if op=='seconds':return math.trunc(self.run(args[0])*300)
        if op in ('sin','cos'):return math_source.call(op,[self.run(args[0])])
        if op=='while':
            count=0
            while self.run(args[0]):
                for child in args[1:]:self.run(child)
                count+=1
                if count>1000:raise ValueError('Unexpected source loop bound')
            return None
        if op=='get-task-status':return self.env['task-statuses'][self.run(args[0])]
        if op=='buzzer-count':return 0
        if op=='task-known?':return self.env['task-statuses'][self.run(args[0])] not in ('unknown','need-hint')
        if op=='cpad-hold?':return False
        if op=='scf-get-territory':return 'GAME_TERRITORY_SCEA'
        if op=='get-aspect-ratio':return self.env['aspect']
        if op=='y-angle':return self.run(args[0])['yaw']
        if op=='set-yaw-angle-clear-roll-pitch!':
            target=self.run(args[0]);target['yaw']=self.run(args[1]);return None
        if op=='spawn':return None
        return super().run(form)


hostforms=parse((root/'engine/ui/progress/progress.gc').read_text())
drawforms=parse((root/'engine/ui/progress/progress-draw.gc').read_text())
functions={f[1]:f for f in hostforms+drawforms if f[:1] in (['defun'],['defmethod'])}
definition=extract_progress_hud(root,parse,walk)
definition['layers']=definition['profiles'][0]['layers']
screen_codes=dict(next(f for f in walk(parse((root/'engine/ui/progress/progress-h.gc').read_text())) if f[:2]==['defenum','progress-screen'])[4:]);screen_codes['frame']=screen_codes['settings']
common=copy.deepcopy(functions['draw-progress'])
body=common[3]
assert body[0]=='let' and [pair[0] for pair in body[1]]==['f30-0','s5-0']
parts=[form for form in body[2:] if isinstance(form,list) and form[0] in ('let','let*') and
       form[1][0][0] in ('f28-1','f28-2')]
assert len(parts)==2
common[3]=['let',body[1],*parts]
particle_writes=lambda form:sum(1 for f in walk(form) if f[:1]==['set!'] and isinstance(f[1],list) and f[1][:3]==['->','this','particles'])
assert particle_writes(common)==particle_writes(functions['draw-progress'])
functions['draw-progress']=common
tables=parse((root/'engine/ui/progress/progress-static.gc').read_text())
eggs=next(f for f in tables if f[:2]==['define','*task-egg-starting-x*'])[2][5:]
assert eggs==[218,194,171,147,124,100,77,53,30]


def evaluate(profile,offset,transition,mode,frame,count,option,stat=False,level=0,next_mode=None,prior_right=None,level_open=True,card_ready=True,filled=None,last_change=0,previous=None):
    particles=[{'init-pos':dict(zip('xyz',layer['position'])),'pos':dict(x=0.,y=0.,z=0.),'part':{'matrix':-1}} for layer in definition['layers']]
    # Source draw-progress consumes the right side's previous frame position.
    particles[2]['init-pos']['x']=prior_right if prior_right is not None else f32(profile['scales']['right-x-offset']+409+math.trunc(f32(301.5*f32(offset/4096))))
    if previous:
        for p,old in zip(particles,previous['positions']):p['init-pos']=copy.deepcopy(old)
    icons=[{'icon':[{'root':{'yaw':icon['yaw']}}]} for icon in definition['icons']]+[{'icon':[{'root':{'yaw':0.}}]},{'icon':[{'root':{'yaw':0.}}]}]
    hud={**{key:f32(value) if isinstance(value,float) else value for key,value in profile['scales'].items()},
         'particles':particles,'particle-state':copy.deepcopy(previous['states']) if previous else definition['states'].copy(),
         'nb-of-particles':32,'icons':icons,'in-out-position':offset,'transition-offset':transition,
         'transition-percentage':f32(transition/512),'transition-percentage-invert':f32(1-f32(transition/512)),
         'stat-transition':stat,'level-transition':level,'display-state':screen_codes[mode],'next-display-state':screen_codes[next_mode or mode],
         'task-index':option,'option-index':option%4,'last-option-index-change':last_change,'in-transition':transition!=0,
         'card-info':{'formatted':int(card_ready),'inited':int(card_ready),'file':[{'present':int((filled or [True,False,True,False])[i]),'level-index':1} for i in range(4)]}}
    env={'this':hud,'*progress-process*':[hud],'*pc-settings*':{'use-vis?':True,'aspect-custom-x':4},
         '*video-parms*':{'relative-y-scale':1.,'screen-sy':224},'PC_PORT':False,'#t':True,'#f':False,'METER_LENGTH':4096,
         '*null-vector*':None,'*cheat-mode*':False,'*common-text*':False,'*kernel-boot-message*':'play',
         '*display*':{'time-adjust-ratio':1.,'real-frame-counter':frame},'aspect':'aspect'+profile['id'].replace(':','x'),
         '*game-info*':{'level-opened':[int(level_open)]},'*task-egg-starting-x*':eggs,
         '*level-task-data*':[{'nb-of-tasks':count,'task-info':[{'task-id':i,'text-index-when-resolved':0} for i in range(8)],'buzzer-task-index':-1}],
         'task-statuses':['unknown','need-hint','need-introduction','need-reminder-a','need-reminder','need-reward-speech','need-resolution','invalid'],
         '*setting-control*':{'current':{'video-mode':'ntsc'}},'*level-task-data-remap*':[0,1],
         '*font-default-matrix*':None,'arg0':{'origin':dict(x=0.,y=0.),'flags':0,'color':0},'GAME_TERRITORY_SCEA':'GAME_TERRITORY_SCEA'}
    if previous:
        for icon,old in zip(icons,previous['icons']):icon['icon'][0]['root']=copy.deepcopy(old)
    goal=PlacementGoal(env,functions)
    goal.run(['hide-progress-icons'])
    if mode in ('fuel-cell','money','buzzer'):
        goal.run(['draw-'+mode+'-screen','this',0])
        goal.run(['draw-progress','this'])
    elif mode=='save-game':goal.run(['draw-memcard-file-select','this','arg0'])
    elif mode=='auto-save':goal.run(['draw-auto-save','this','arg0'])
    goal.run(['adjust-sprites','this'])
    return {'positions':[p['init-pos'] for p in particles],'origins':[p['pos'] for p in particles],
            'states':hud['particle-state'],'icons':[icon['icon'][0]['root'] for icon in icons],
            'scales':{k:v for k,v in hud.items() if '-scale' in k}}


if __name__=='__main__':
    cases=[]
    for profile in definition['profiles']:
        for mode in ['fuel-cell','money','buzzer','save-game','auto-save','frame']:
            for offset in [4096,2867,2048,1024,0]:
                for transition in [512,256,0]:
                    for frame,count,option in [(0,0,0),(600,1,0),(870,8,7),(900,8,2),(1200,8,4)]:
                        cases.append({'format':profile['id'],'mode':mode,'offset':offset,'transition':transition,'clock':frame,
                            'count':count,'option':option,'result':evaluate(profile,offset,transition,mode,frame,count,option)})
    for profile in definition['profiles']:
        for mode in ['fuel-cell','money','buzzer','save-game']:
            for stat,level,next_mode in [(True,0,'buzzer'),(True,0,'money'),(False,1,mode),(False,2,mode)]:
                for transition in [0,150,256,270,512]:
                    for prior_right in [-320.,409.,710.]:
                        values=dict(format=profile['id'],mode=mode,offset=0,transition=transition,clock=875,count=8,option=2,
                            stat=stat,level=level,next_mode=next_mode,prior_right=prior_right,level_open=True,card_ready=True,
                            filled=[False,True,True,True],last_change=200)
                        cases.append({**values,'result':evaluate(profile,0,transition,mode,875,8,2,**{k:v for k,v in values.items() if k in ('stat','level','next_mode','prior_right','level_open','card_ready','filled','last_change')})})
    for profile in definition['profiles']:
        for mode in ['fuel-cell','save-game']:
            values=dict(format=profile['id'],mode=mode,offset=0,transition=0,clock=900,count=8,option=0,level_open=False,card_ready=False)
            cases.append({**values,'result':evaluate(profile,0,0,mode,900,8,0,level_open=False,card_ready=False)})
    states={f[1]:f for f in hostforms if f[:1]==['defstate'] and f[2]==['progress']}
    normal=states['progress-normal'];normal_loop=normal[normal.index(':code')+1][2]
    assert [f[0] for f in normal_loop[2:8]]==['if','set-transition-progress!','set!','when','when','let']
    # Keep the original transition and arrow code; gamepad responses are supplied
    # as explicit fixture events, not emulated game input.
    normal_code=['loop',*normal_loop[2:8]]
    timelines=[]
    names={value:name for name,value in screen_codes.items() if name in ('fuel-cell','money','buzzer','save-game','auto-save','frame')}
    for profile in definition['profiles']:
        for start in ['fuel-cell','money','buzzer','save-game','auto-save','frame']:
            particles=[{'init-pos':dict(zip('xyz',layer['position']))} for layer in profile['layers']]
            hud={'in-out-position':4096,'transition-offset':512,'transition-percentage':1.,'transition-percentage-invert':0.,
                 'display-state':screen_codes[start],'next-display-state':screen_codes[start],
                 'display-level-index':2,'next-level-index':2,'stat-transition':False,'level-transition':0,
                 'force-transition':False,'in-transition':False,'option-index':0,'last-option-index-change':0,
                 'task-index':2,'particles':particles,'left-x-offset':profile['scales']['left-x-offset']}
            data={'nb-of-tasks':8,'task-info':[{'task-id':i} for i in range(8)]}
            env={'self':hud,'this':hud,'*display*':{'time-adjust-ratio':1.,'real-frame-counter':0},
                 '*game-info*':{'auto-save-proc':None,'level-opened':[1]*5},'*level-task-data*':[data]*5,
                 '*progress-process*':[hud],'*progress-state*':{'last-slot-saved':0},'#t':True,'#f':False,
                 '*cheat-mode*':False,'task-statuses':['unknown','need-hint','need-introduction','need-reminder-a',
                     'need-reminder','need-reward-speech','need-resolution','invalid']}
            goal=PlacementGoal(env,functions);goal.run(['set-transition-speed!','self'])
            phase='progress-coming-in';clock=5;previous=None
            records=[{'action':'wait','phase':'waiting','clock':clock,'offset':4096,'transition':512,'page':start,'active':False}]
            events=[('arrive',70)]
            if start=='fuel-cell':events += [('money',35),('buzzer',35),('level-up',35),('level-down',35),('save-game',55),('slot',155),('auto-save',65),('frame',65)]
            events += [('hide',75)]
            for action,duration in events:
                if action in names.values() and action!=start:
                    hud['next-display-state']=screen_codes[action]
                    hud['stat-transition']=hud['display-state'] in (0,1,2) and screen_codes[action] in (0,1,2)
                if action in ('level-up','level-down'):
                    hud['next-level-index']=hud['display-level-index']+(1 if action=='level-up' else -1)
                    hud['level-transition']=1 if action=='level-up' else 2
                if action=='slot':hud['option-index']=2;hud['last-option-index-change']=clock
                if action=='hide':
                    phase='progress-going-out'
                    hud['particles'][3]['init-pos']['x']=hud['particles'][4]['init-pos']['x']=-320.
                    if hud['display-state']==17:hud['transition-speed']=30.
                for _ in range(duration):
                    clock+=5;env['*display*']['real-frame-counter']=clock
                    active=phase!='progress-gone'
                    if active:
                        env['oracleNextState']=phase
                        form=states[phase]
                        goal.run(normal_code if phase=='progress-normal' else form[form.index(':code')+1][2])
                        phase=env['oracleNextState'];active=phase!='progress-gone'
                    record={'action':action,'clock':clock,'phase':{'progress-coming-in':'arriving','progress-normal':'in','progress-going-out':'leaving','progress-gone':'hidden'}[phase],
                            'offset':hud['in-out-position'],'transition':hud['transition-offset'],'page':names[hud['display-state']],
                            'nextPage':names[hud['next-display-state']],'option':hud['option-index'],'taskIndex':hud['task-index'],'active':active}
                    if active:
                        if previous is None:previous={'positions':[copy.deepcopy(p['init-pos']) for p in hud['particles']],
                            'states':definition['states'].copy(),'icons':[{'yaw':i['yaw']} for i in definition['icons']]+[{'yaw':0.},{'yaw':0.}]}
                        else:previous['positions']=[copy.deepcopy(p['init-pos']) for p in hud['particles']]
                        result=evaluate(profile,hud['in-out-position'],hud['transition-offset'],record['page'],clock,8,hud['task-index'],
                            stat=hud['stat-transition'],level=hud['level-transition'],next_mode=record['nextPage'],
                            last_change=hud['last-option-index-change'],previous=previous)
                        # Card selection and task selection are independent owner fields.
                        if record['page']=='save-game':
                            result=evaluate(profile,hud['in-out-position'],hud['transition-offset'],record['page'],clock,8,hud['option-index'],
                                stat=hud['stat-transition'],level=hud['level-transition'],next_mode=record['nextPage'],
                                last_change=hud['last-option-index-change'],previous=previous)
                        for icon in result['icons'][:4]:icon['yaw']=f32((icon['yaw']+32768)%65536-32768)
                        for p,pos in zip(hud['particles'],result['positions']):p['init-pos']=copy.deepcopy(pos)
                        previous=result;record['result']=copy.deepcopy(result)
                    records.append(record)
            timelines.append({'format':profile['id'],'start':start,'records':records})
    path=args.output
    path.write_text(json.dumps({'status':'SOURCE_ORACLE','cases':cases,'timelines':timelines,'sources':definition['sources']},separators=(',',':'))+'\n')
    print(json.dumps({'status':'SOURCE_ORACLE','cases':len(cases),'frames':sum(len(t['records']) for t in timelines),'path':str(path)}))
