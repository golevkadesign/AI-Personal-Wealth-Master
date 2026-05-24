import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Activity, Target, Shield, Briefcase, Globe, Clock, CheckCircle2, User, Edit3 } from 'lucide-react';
import { useWealthStore } from '../hooks/useWealthStore';

export const ProfileReportView = ({ isOpen, onClose }: any) => {
  const { data, commitData } = useWealthStore();
  const [localProfile, setLocalProfile] = useState<any>({});
  const [localPersona, setLocalPersona] = useState<any>({ tags: [], description: '' });
  const [localContext, setLocalContext] = useState('');
  const [localGoal, setLocalGoal] = useState<any>({});
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      const profile = data?.userProfile || {};
      const persona = data?.userPersona || { tags: [], description: '' };
      const context = data?.insights?.global || '';
      const goal = data?.goal || { name: '财富长期增值与家族传承', current: 0, target: 1, index: 0 };
      
      setLocalProfile(profile);
      setLocalPersona(persona);
      setLocalContext(context);
      setLocalGoal(goal);
      setEditingSection(null);
      setInitialSnapshot({ profile, persona, context, goal });
    }
  }, [isOpen, data]);

  const handleClose = () => {
    const isDirty = initialSnapshot && (
      JSON.stringify(localProfile) !== JSON.stringify(initialSnapshot.profile) ||
      JSON.stringify(localPersona) !== JSON.stringify(initialSnapshot.persona) ||
      localContext !== initialSnapshot.context ||
      JSON.stringify(localGoal) !== JSON.stringify(initialSnapshot.goal)
    );

    if (isDirty) {
      if (window.confirm('有未保存修改，确认放弃吗？')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    const rawIndex = localGoal.index;
    let validIndex = data?.goal?.index || 0;
    
    if (typeof rawIndex === 'number' && !isNaN(rawIndex)) {
       validIndex = rawIndex;
    } else if (typeof rawIndex === 'string') {
       const parsed = parseFloat(rawIndex.replace(/[^0-9.-]+/g, ''));
       if (!isNaN(parsed)) {
          validIndex = parsed;
       }
    }

    const normalizedGoal = {
      ...localGoal,
      current: Number(localGoal.current) || 0,
      target: Number(localGoal.target) || 0,
      index: validIndex
    };

    commitData((prev: any) => ({
      ...prev,
      userPersona: {
        ...(prev?.userPersona || {}),
        ...localPersona
      },
      userProfile: {
        ...(prev?.userProfile || {}),
        ...localProfile
      },
      insights: {
        ...(prev?.insights || {}),
        global: localContext
      },
      goal: {
        ...(prev?.goal || {}),
        ...normalizedGoal
      }
    }));
    setEditingSection(null);
    onClose();
  };

  if (!isOpen) return null;

  const strategies = data?.lifeStrategiesLong?.length > 0 
    ? data.lifeStrategiesLong 
    : (data?.lifeStrategiesShort || []);
    
  const persona = data?.userPersona || { tags: [], description: '' };
  
  // Use localGoal for rendering progress and stats so edits reflect immediately
  const percent = localGoal.target > 0 ? Math.min(100, Math.round((localGoal.current / localGoal.target) * 100)) : 0;

  const hasProfile = Object.keys(localProfile).some(k => k !== 'name' && localProfile[k]);
  const hasPersonaTags = localPersona?.tags?.length > 0;
  const hasContext = localContext && localContext.length > 5;
  const hasStrategies = strategies && strategies.length > 0;
  const hasSync = !!data?._liveFetchedAt;

  const SectionCard = ({ title, enTitle, fieldName, children, className = '' }: any) => {
    const isEditing = editingSection === fieldName;
    return (
      <div className={`bg-[#121415]/60 border border-[#C9B284]/10 rounded-xl p-6 relative ${className}`}>
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-[#E7D7B0] tracking-wide">{title}</span>
            <span className="text-[11px] text-[#8C8370] font-mono tracking-widest uppercase">/ {enTitle}</span>
          </div>
          {fieldName && (
            <button 
              onClick={() => setEditingSection(isEditing ? null : fieldName)}
              className={`p-1.5 rounded transition-colors ${
                isEditing ? 'bg-[#C9B284]/20 text-[#E7D7B0]' : 'text-[#8C8370] hover:text-[#C9B284] hover:bg-[#C9B284]/10'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {typeof children === 'function' ? children(isEditing) : children}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center p-4 lg:p-8 overflow-y-auto custom-scroll">
      {/* Dark overlay backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"></div>
      
      {/* Modal Container */}
      <div className="relative w-full max-w-[1280px] max-h-[95vh] min-h-[90vh] bg-[#0B0D0F] border border-[#C9B284]/20 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.7)] flex flex-col font-sans overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Glow effect at top edge */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-[#C9B284]/40 to-transparent"></div>
        
        {/* Report Header */}
        <div className="px-8 py-5 flex items-center justify-between shrink-0 border-b border-[#C9B284]/10 bg-[#121415]/80">
          <div>
            <h2 className="text-2xl font-bold text-[#E7D7B0] tracking-wide flex items-center gap-3">
              长线记忆 <span className="font-light text-[#8C8370]">/</span> <span className="font-serif">Memory Profile</span>
            </h2>
            <p className="text-[#8C8370] text-[11px] font-mono tracking-widest mt-1.5 uppercase">
              Private wealth context and long-term strategy memory
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleClose} 
              className="px-4 py-2 border border-[#C9B284]/30 hover:border-[#C9B284]/50 bg-[#16181A]/80 hover:bg-[#C9B284]/10 text-[#E7D7B0] text-sm font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              关闭 Close <X className="w-4 h-4"/>
            </button>
            <button 
              onClick={handleSave} 
              className="px-6 py-2 bg-[#C9B284] hover:bg-[#E7D7B0] text-[#121415] text-sm font-bold rounded-lg transition-all shadow-[0_0_15px_rgba(201,178,132,0.15)] hover:shadow-[0_0_20px_rgba(201,178,132,0.3)] cursor-pointer"
            >
              保存 Save
            </button>
          </div>
        </div>

        {/* Content Body - Three Columns */}
        <div className="flex-1 overflow-y-auto custom-scroll p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            
            {/* 1. Left Sidebar (Identity & Summary) */}
            <div className="lg:col-span-3 space-y-6">
              {/* Identity Placeholder */}
              <div className="flex flex-col items-center bg-[#121416]/40 border border-[#C9B284]/10 rounded-xl p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[#C9B284]/5 to-transparent"></div>
                <div className="w-24 h-24 rounded-full bg-[#1A1D20] border-2 border-[#C9B284]/30 shadow-[0_0_30px_rgba(201,178,132,0.05)] flex items-center justify-center mb-5 text-[#C9B284] relative z-10">
                  <User className="w-12 h-12 opacity-60" />
                </div>
                <h3 className="text-xl font-bold text-[#E7D7B0] relative z-10">{localProfile.name || 'Client A'}</h3>
                <span className="text-[#8C8370] text-xs font-medium mt-1.5 relative z-10">私人财富客户</span>
                <span className="text-[#C9B284] border border-[#C9B284]/20 bg-[#C9B284]/5 px-2.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest mt-3 relative z-10">
                  Private Client
                </span>
              </div>

              {/* Persona Context and Tags */}
              <div className="group relative">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-[11px] text-[#8C8370] font-mono uppercase tracking-wider">用户画像 / Persona</h4>
                  <button 
                    onClick={() => setEditingSection(editingSection === 'persona' ? null : 'persona')}
                    className={`p-1 rounded transition-colors ${
                      editingSection === 'persona' ? 'bg-[#C9B284]/20 text-[#E7D7B0]' : 'text-[#8C8370] hover:text-[#C9B284] hover:bg-[#C9B284]/10 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                {editingSection === 'persona' ? (
                  <div className="space-y-4">
                    <textarea 
                      className="w-full bg-[#0B0D0F] border border-[#1A1D20] px-3 py-2 text-[13px] text-slate-300 rounded-lg focus:outline-none focus:border-[#C9B284]/50 transition-all resize-none min-h-[80px]"
                      value={localPersona.description || ''}
                      onChange={(e) => setLocalPersona({...localPersona, description: e.target.value})}
                      placeholder="Persona description..."
                    />
                    <div>
                      <h4 className="text-[11px] text-[#8C8370] font-mono uppercase tracking-wider mb-2">关键标签 / Tags (逗号分隔)</h4>
                      <input 
                        type="text"
                        className="w-full bg-[#0B0D0F] border border-[#1A1D20] px-3 py-2 text-[12px] text-slate-300 rounded-lg focus:outline-none focus:border-[#C9B284]/50 transition-all"
                        value={(localPersona.tags || []).join(', ')}
                        onChange={(e) => setLocalPersona({...localPersona, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                        placeholder="Tag1, Tag2..."
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[13px] text-slate-300 leading-relaxed font-light mb-5">
                      {localPersona.description || '暂未生成长线画像，系统将基于未来的会话自动沉淀...'}
                    </p>
                    <div>
                      <h4 className="text-[11px] text-[#8C8370] font-mono uppercase tracking-wider mb-2.5">关键标签 / Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {localPersona.tags?.length > 0 ? localPersona.tags.map((t: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 text-[11px] text-[#C9B284] border border-[#C9B284]/25 rounded bg-[#C9B284]/5">
                            {t}
                          </span>
                        )) : (
                          <span className="text-xs text-slate-500">自动沉淀中...</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Goal Progress */}
              <div className="pt-2">
                <h4 className="text-[11px] text-[#8C8370] font-mono uppercase tracking-wider mb-2.5">目标进度 / Goal Progress</h4>
                <div className="bg-[#121416]/60 border border-[#C9B284]/12 rounded-xl p-5">
                  <div className="text-[13px] text-[#E7D7B0] font-bold mb-5 flex items-center justify-between">
                    {editingSection === 'goal' ? (
                      <input 
                        className="bg-[#0B0D0F] border border-[#1A1D20] px-3 py-1.5 text-[13px] text-[#E7D7B0] font-bold rounded-lg w-full mr-3 focus:outline-none focus:border-[#C9B284]/50 transition-all"
                        value={localGoal.name || ''}
                        onChange={(e) => setLocalGoal({...localGoal, name: e.target.value})}
                      />
                    ) : (
                      <span>{localGoal.name || '财富长期增值'}</span>
                    )}
                    <button 
                      onClick={() => setEditingSection(editingSection === 'goal' ? null : 'goal')}
                      className={`p-1.5 rounded transition-colors shrink-0 ${
                        editingSection === 'goal' ? 'bg-[#C9B284]/20 text-[#E7D7B0]' : 'text-[#8C8370] hover:text-[#C9B284] hover:bg-[#C9B284]/10'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                  
                  {editingSection === 'goal' ? (
                    <div className="space-y-4 mb-3">
                       <div className="flex flex-col gap-1.5">
                         <label className="text-[10px] text-[#8C8370] font-mono uppercase">当前 / Current (¥)</label>
                         <input 
                           type="number"
                           className="bg-[#0B0D0F] border border-[#1A1D20] px-3 py-2 text-[12px] text-slate-200 rounded-lg w-full focus:outline-none focus:border-[#C9B284]/50 transition-all"
                           value={localGoal.current || 0}
                           onChange={(e) => setLocalGoal({...localGoal, current: Number(e.target.value)})}
                         />
                       </div>
                       <div className="flex flex-col gap-1.5">
                         <label className="text-[10px] text-[#8C8370] font-mono uppercase">目标 / Target (¥)</label>
                         <input 
                           type="number"
                           className="bg-[#0B0D0F] border border-[#1A1D20] px-3 py-2 text-[12px] text-slate-200 rounded-lg w-full focus:outline-none focus:border-[#C9B284]/50 transition-all"
                           value={localGoal.target || 0}
                           onChange={(e) => setLocalGoal({...localGoal, target: Number(e.target.value)})}
                         />
                       </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-5">
                        <div className="flex items-end gap-2 font-mono mb-2">
                          <span className="text-3xl font-light text-[#E7D7B0] leading-none">{percent}</span>
                          <span className="text-sm text-[#E7D7B0] mb-0.5">%</span>
                          <span className="text-[10px] text-[#8C8370] uppercase ml-auto mb-1">Progress</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#1A1D20] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#C9B284]/40 to-[#C9B284]" style={{ width: `${percent}%` }}></div>
                        </div>
                      </div>
                      <div className="flex justify-between text-[11px] font-mono text-[#8C8370] mb-4">
                        <div className="flex flex-col">
                          <span className="uppercase text-[9px] mb-1 opacity-70">当前 / Current</span>
                          <span className="text-slate-300">¥ {(localGoal.current || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="uppercase text-[9px] mb-1 opacity-70">目标 / Target</span>
                          <span className="text-[#E7D7B0]">¥ {(localGoal.target || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="border-t border-[#C9B284]/10 pt-3 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#8C8370] opacity-80">目标指数 / Goal Index:</span>
                    {editingSection === 'goal' ? (
                      <div className="flex items-center">
                        <input 
                           type="text"
                           className="bg-[#0B0D0F] border border-[#1A1D20] px-2 py-0.5 text-right w-16 text-[#C9B284] font-bold rounded focus:outline-none focus:border-[#C9B284]/50 transition-all"
                           value={localGoal.index || ''}
                           onChange={(e) => setLocalGoal({...localGoal, index: e.target.value})}
                           placeholder="1.00"
                        />
                        <span className="text-[#C9B284] font-bold ml-1">x</span>
                      </div>
                    ) : (
                      <span className="text-[#C9B284] font-bold">
                        {localGoal.index !== undefined ? `${localGoal.index}x` : '1.68x'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Main Content (Report Panels) */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Editable User Profile */}
              <SectionCard title="用户基本信息" enTitle="User Profile" fieldName="profile">
                {(isEditing: boolean) => (
                  <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#8C8370] font-mono">称呼 / Name</label>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={localProfile.name || ''} 
                          onChange={e => setLocalProfile({...localProfile, name: e.target.value})}
                          className="w-full bg-[#0B0D0F] border border-[#1A1D20] rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none focus:border-[#C9B284]/50 focus:bg-[#121415] transition-all"
                          placeholder="e.g. Client A"
                        />
                      ) : (
                        <div className="text-[13px] text-slate-200 py-1">{localProfile.name || '—'}</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#8C8370] font-mono">主要居住地 / Location</label>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={localProfile.location || ''} 
                          onChange={e => setLocalProfile({...localProfile, location: e.target.value})}
                          className="w-full bg-[#0B0D0F] border border-[#1A1D20] rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none focus:border-[#C9B284]/50 focus:bg-[#121415] transition-all"
                          placeholder="e.g. Asia / Hong Kong"
                        />
                      ) : (
                        <div className="text-[13px] text-slate-200 py-1">{localProfile.location || '—'}</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#8C8370] font-mono">职业背景 / Background</label>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={localProfile.background || ''} 
                          onChange={e => setLocalProfile({...localProfile, background: e.target.value})}
                          className="w-full bg-[#0B0D0F] border border-[#1A1D20] rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none focus:border-[#C9B284]/50 focus:bg-[#121415] transition-all"
                          placeholder="e.g. Business Management"
                        />
                      ) : (
                        <div className="text-[13px] text-slate-200 py-1">{localProfile.background || '—'}</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#8C8370] font-mono">财富阶段 / Wealth Stage</label>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={localProfile.wealthStage || ''} 
                          onChange={e => setLocalProfile({...localProfile, wealthStage: e.target.value})}
                          className="w-full bg-[#0B0D0F] border border-[#1A1D20] rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none focus:border-[#C9B284]/50 focus:bg-[#121415] transition-all"
                          placeholder="e.g. High Net Worth"
                        />
                      ) : (
                        <div className="text-[13px] text-slate-200 py-1">{localProfile.wealthStage || '—'}</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#8C8370] font-mono">年龄段 / Age Range</label>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={localProfile.ageRange || ''} 
                          onChange={e => setLocalProfile({...localProfile, ageRange: e.target.value})}
                          className="w-full bg-[#0B0D0F] border border-[#1A1D20] rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none focus:border-[#C9B284]/50 focus:bg-[#121415] transition-all"
                          placeholder="e.g. 40-50"
                        />
                      ) : (
                        <div className="text-[13px] text-slate-200 py-1">{localProfile.ageRange || '—'}</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#8C8370] font-mono">备注 / Notes</label>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={localProfile.notes || ''} 
                          onChange={e => setLocalProfile({...localProfile, notes: e.target.value})}
                          className="w-full bg-[#0B0D0F] border border-[#1A1D20] rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none focus:border-[#C9B284]/50 focus:bg-[#121415] transition-all"
                          placeholder="e.g. 长期合作客户..."
                        />
                      ) : (
                        <div className="text-[13px] text-slate-200 py-1">{localProfile.notes || '—'}</div>
                      )}
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* Long-term Context Edit/View */}
              <SectionCard title="长期财富上下文" enTitle="Long-term Context" fieldName="context">
                {(isEditing: boolean) => (
                  isEditing ? (
                    <textarea
                      value={localContext}
                      onChange={e => setLocalContext(e.target.value)}
                      className="w-full bg-[#0B0D0F] border border-[#1A1D20] rounded-lg px-4 py-3 text-[13px] text-slate-300 leading-relaxed focus:outline-none focus:border-[#C9B284]/50 focus:bg-[#121415] transition-all resize-none min-h-[100px] custom-scroll"
                      placeholder="正在沉淀长期财富目标与战略上下文..."
                    />
                  ) : (
                    <p className="text-[13px] text-slate-300 leading-relaxed font-light whitespace-pre-wrap py-2">
                      {localContext || '暂未沉淀长期财富上下文...'}
                    </p>
                  )
                )}
              </SectionCard>

              {/* Wealth Preference (Visual) */}
              <SectionCard title="财富偏好" enTitle="Wealth Preference">
                {hasPersonaTags ? (
                  <div className="flex flex-wrap gap-2 py-3 bg-[#0B0D0F] rounded-lg border border-[#1A1D20] px-4">
                    {localPersona.tags.map((tag: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-[#1A1D20] text-[#E7D7B0] border border-[#C9B284]/20 rounded-md text-[11px] font-mono">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-6 bg-[#0B0D0F] rounded-lg border border-[#1A1D20]">
                    <div className="text-[11px] text-[#8C8370] italic">基于历史会话的系统标签识别中...（待沉淀）</div>
                  </div>
                )}
              </SectionCard>

              {/* Risk Tolerance */}
              <SectionCard title="风险偏好" enTitle="Risk Tolerance">
                <div className="flex items-center gap-6 p-2">
                  <div className="w-12 h-12 rounded-full border-2 border-[#C9B284]/20 flex items-center justify-center shrink-0 shadow-inner bg-[#1A1D20]/50">
                    <ShieldAlert className="w-5 h-5 text-[#C9B284]/30" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <div className="text-[13px] font-bold text-[#E7D7B0]">待评估 <span className="font-mono text-[11px] text-[#8C8370] ml-1">( 缺失数据 )</span></div>
                        <div className="text-[11px] text-[#8C8370] mt-1">系统暂无足够持仓与交易行为特征生成真实风险画像。</div>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Life Strategy Notes */}
              <SectionCard title="人生策略与长期规划" enTitle="Life Strategy Notes">
                <ul className="space-y-3.5 mt-2">
                  {strategies.length > 0 ? strategies.map((s: any, idx: number) => (
                    <li key={idx} className="flex gap-3.5 items-start text-[13px] text-slate-300">
                      <span className="w-1 h-3 rounded-full bg-[#C9B284]/60 mt-1 shrink-0" />
                      <span className="leading-relaxed font-light">{s.description || s.title}</span>
                    </li>
                  )) : (
                    <li className="flex gap-3.5 items-start text-[13px] text-slate-300">
                      <span className="w-1 h-3 rounded-full bg-[#C9B284]/60 mt-1 shrink-0" />
                      <span className="leading-relaxed font-light">正在基于全周期会话沉淀家族传承、大类资产平滑等生命周期策略...</span>
                    </li>
                  )}
                </ul>
              </SectionCard>

            </div>

            {/* 3. Right Sidebar (Quality & Meta) */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Memory Quality */}
              <div className="bg-[#121415]/60 border border-[#C9B284]/10 rounded-xl p-8 flex flex-col items-center relative overflow-hidden">
                <span className="text-[11px] text-[#A39167] font-mono uppercase tracking-wider w-full text-left mb-6 font-semibold">AI 记忆质量 / Memory Quality</span>
                
                <div className="relative w-32 h-32 flex items-center justify-center mb-6 mt-2">
                  <div className="absolute inset-0 bg-[#C9B284]/5 rounded-full blur-[20px]"></div>
                  
                  <div className="absolute inset-4 rounded-full border border-[#1A1D20] bg-[#0E1012] flex items-center justify-center z-20">
                     <span className="text-[11px] text-[#8C8370] text-center leading-relaxed">暂无真实<br/>质量评分</span>
                  </div>
                </div>
                
                <div className="text-center w-full">
                  <div className="text-[13px] text-[#E7D7B0] font-medium mb-1">待长期会话沉淀</div>
                  <div className="text-[10px] text-[#8C8370] leading-relaxed">系统需要更多结构化对话历史以准确评估记忆维度。</div>
                </div>
              </div>

              {/* Context Completeness */}
              <div className="bg-[#121415]/60 border border-[#C9B284]/10 rounded-xl p-6">
                <span className="text-[11px] text-[#A39167] font-mono uppercase tracking-wider block mb-5 font-semibold">上下文维度状态 / Context Status</span>
                <div className="space-y-4">
                  {[
                    { label: '身份信息', active: hasProfile },
                    { label: '财富上下文', active: hasContext },
                    { label: '投资偏好', active: hasPersonaTags },
                    { label: '风险评估', active: false },
                    { label: '人生策略', active: hasStrategies },
                    { label: '数据挂载', active: hasSync },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-300 w-16 shrink-0">{item.label}</span>
                      <div className="flex-1 h-1 bg-[#1A1D20] rounded-full overflow-hidden relative">
                        <div className="absolute left-0 top-0 h-full bg-[#C9B284]/80 rounded-full transition-all duration-500" style={{ width: item.active ? '100%' : '0%' }}></div>
                      </div>
                      <span className={`text-[10px] font-mono w-10 text-right shrink-0 ${item.active ? 'text-[#E7D7B0]' : 'text-[#8C8370]'}`}>
                        {item.active ? '已沉淀' : '待补充'}
                      </span>
                    </div>
                  ))}
                  <div className="text-[9px] text-[#8C8370] mt-3 text-center italic">基于已填写字段估算</div>
                </div>
              </div>

              {/* Last Updated */}
              <div className="bg-[#121415]/60 border border-[#C9B284]/10 rounded-xl p-6">
                <span className="text-[11px] text-[#A39167] font-mono uppercase tracking-wider block mb-4 font-semibold">最后挂载 / Last Synced</span>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#1A1D20] border border-[#C9B284]/20 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-[#C9B284]/50" />
                  </div>
                  <div>
                    <div className="text-[12px] font-mono text-[#E7D7B0]">
                      {data?._liveFetchedAt ? new Date(data._liveFetchedAt).toLocaleString() : '暂无同步记录'}
                    </div>
                    <div className="text-[10px] text-[#8C8370] mt-0.5">
                      {data?._liveFetchedAt ? '由 Arbi AI 自动写入' : '等待应用主动挂载'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Sources */}
              <div className="bg-[#121415]/60 border border-[#C9B284]/10 rounded-xl p-6">
                <span className="text-[11px] text-[#A39167] font-mono uppercase tracking-wider block mb-4 font-semibold">数据来源 / Data Sources</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0E1012] border border-[#1A1D20]">
                     <CheckCircle2 className={`w-4 h-4 ${hasContext ? 'text-[#C9B284]' : 'text-[#C9B284]/30'} shrink-0`} />
                     <div className="flex flex-col">
                        <div className="text-[11px] text-slate-300 mb-0.5">对话记录</div>
                        <div className="text-[9px] text-[#8C8370] font-mono">Agent 抽取</div>
                     </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0E1012] border border-[#1A1D20]">
                     <Activity className={`w-4 h-4 ${hasSync ? 'text-[#C9B284]' : 'text-[#C9B284]/30'} shrink-0`} />
                     <div className="flex flex-col">
                        <div className="text-[11px] text-slate-300 mb-0.5">投资组合</div>
                        <div className="text-[9px] text-[#8C8370] font-mono">实盘挂载</div>
                     </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0E1012] border border-[#1A1D20]">
                     <Globe className={`w-4 h-4 ${hasStrategies ? 'text-[#C9B284]' : 'text-[#C9B284]/30'} shrink-0`} />
                     <div className="flex flex-col">
                        <div className="text-[11px] text-slate-300 mb-0.5">市场洞察</div>
                        <div className="text-[9px] text-[#8C8370] font-mono">RAG 知识库</div>
                     </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0E1012] border border-[#1A1D20]">
                     <Briefcase className="w-4 h-4 text-[#C9B284]/30 shrink-0" />
                     <div className="flex flex-col">
                        <div className="text-[11px] text-slate-300 mb-0.5">外部研究</div>
                        <div className="text-[9px] text-[#8C8370] font-mono">待接入</div>
                     </div>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </div>

        {/* Footer Area */}
        <div className="px-8 py-4 border-t border-[#C9B284]/15 bg-[#0B0D0F] flex justify-between items-center text-[10px] text-[#A39167] font-mono shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.3)] z-10 relative">
          <div className="flex flex-row items-center gap-2 opacity-80">
            <Shield size={13} className="text-[#C9B284]"/> 
            <span>您的隐私与数据安全受到最高级别保护 (SOC Type II Compliant)</span>
          </div>
          <div className="flex items-center gap-4 opacity-80">
            <span>Memory Profile ID: MP-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001</span>
          </div>
        </div>
        
      </div>
    </div>
  );
};

