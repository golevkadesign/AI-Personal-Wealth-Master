import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Activity, Target, Shield, Briefcase, Globe, Clock, CheckCircle2, User, Edit3 } from 'lucide-react';

export const ProfileReportView = ({ isOpen, onClose, data, commitData }: any) => {
  const [localProfile, setLocalProfile] = useState<any>({});
  const [localPersona, setLocalPersona] = useState<any>({ tags: [], description: '' });
  const [localContext, setLocalContext] = useState('');
  const [localGoal, setLocalGoal] = useState<any>({});
  const [editingSection, setEditingSection] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalProfile(data?.userProfile || {});
      setLocalPersona(data?.userPersona || { tags: [], description: '' });
      setLocalContext(data?.insights?.global || '');
      setLocalGoal(data?.goal || { name: '财富长期增值与家族传承', current: 0, target: 1, index: 0 });
      setEditingSection(null);
    }
  }, [isOpen, data]);

  const handleSave = () => {
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
        ...localGoal
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
              onClick={onClose} 
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
                      <input 
                         type="text"
                         className="bg-[#0B0D0F] border border-[#1A1D20] px-2 py-0.5 text-right w-16 text-[#C9B284] font-bold rounded focus:outline-none focus:border-[#C9B284]/50 transition-all"
                         value={localGoal.index || ''}
                         onChange={(e) => setLocalGoal({...localGoal, index: e.target.value})}
                         placeholder="1.00x"
                      />
                    ) : (
                      <span className="text-[#C9B284] font-bold">{localGoal.index || '1.68x'}</span>
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
                <div className="flex items-center justify-between gap-2 py-3 bg-[#0B0D0F] rounded-lg border border-[#1A1D20]">
                   <div className="flex flex-col items-center flex-1 gap-2 border-r border-[#C9B284]/10 last:border-0 relative group">
                      <Activity className="w-5 h-5 text-[#C9B284]/60 group-hover:text-[#C9B284] transition-colors" />
                      <div className="text-center">
                          <div className="text-[10px] text-[#8C8370] mb-0.5 font-mono">投资风格</div>
                          <div className="text-[11px] text-slate-300">价值投资为主</div>
                      </div>
                   </div>
                   <div className="flex flex-col items-center flex-1 gap-2 border-r border-[#C9B284]/10 last:border-0 relative group">
                      <Target className="w-5 h-5 text-[#C9B284]/60 group-hover:text-[#C9B284] transition-colors" />
                      <div className="text-center">
                          <div className="text-[10px] text-[#8C8370] mb-0.5 font-mono">持有周期</div>
                          <div className="text-[11px] text-slate-300">长期持有 (5年以上)</div>
                      </div>
                   </div>
                   <div className="flex flex-col items-center flex-1 gap-2 border-r border-[#C9B284]/10 last:border-0 relative group">
                      <Globe className="w-5 h-5 text-[#C9B284]/60 group-hover:text-[#C9B284] transition-colors" />
                      <div className="text-center">
                          <div className="text-[10px] text-[#8C8370] mb-0.5 font-mono">关注领域</div>
                          <div className="text-[11px] text-slate-300">全球宏观、科技、消费</div>
                      </div>
                   </div>
                   <div className="flex flex-col items-center flex-1 gap-2 border-r border-[#C9B284]/10 last:border-0 relative group">
                      <Shield className="w-5 h-5 text-[#C9B284]/60 group-hover:text-[#C9B284] transition-colors" />
                      <div className="text-center">
                          <div className="text-[10px] text-[#8C8370] mb-0.5 font-mono">偏好资产</div>
                          <div className="text-[11px] text-slate-300">股票、固收、另类</div>
                      </div>
                   </div>
                </div>
              </SectionCard>

              {/* Risk Tolerance */}
              <SectionCard title="风险偏好" enTitle="Risk Tolerance">
                <div className="flex items-center gap-6 p-2">
                  <div className="w-12 h-12 rounded-full border-2 border-[#C9B284]/20 flex items-center justify-center shrink-0 shadow-inner bg-[#1A1D20]/50">
                    <ShieldAlert className="w-5 h-5 text-[#C9B284]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <div className="text-[13px] font-bold text-[#E7D7B0]">中等偏稳健 <span className="font-mono text-[11px] text-[#8C8370] ml-1">( 3 / 5 )</span></div>
                        <div className="text-[11px] text-[#8C8370] mt-1">可承受适度波动以换取长期回报，注重风险控制与回撤管理。</div>
                      </div>
                    </div>
                    {/* Mock Progress Slider with tick marks */}
                    <div className="relative w-full h-1 bg-[#1A1D20] rounded-full flex items-center">
                      <div className="absolute left-[50%] top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[#C9B284] rounded-full shadow-[0_0_12px_rgba(201,178,132,0.6)] z-10"></div>
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-full bg-gradient-to-r from-[#C9B284]/20 to-[#C9B284]/60 rounded-full" style={{ width: '50%' }}></div>
                      <div className="absolute w-full flex justify-between text-[10px] font-mono top-[14px]">
                        <span className="text-[#8C8370] opacity-50">1</span>
                        <span className="text-[#8C8370] opacity-50">2</span>
                        <span className="text-[#C9B284] font-bold">3</span>
                        <span className="text-[#8C8370] opacity-50">4</span>
                        <span className="text-[#8C8370] opacity-50">5</span>
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
                
                <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                  {/* Outer glow */}
                  <div className="absolute inset-0 bg-[#C9B284]/5 rounded-full blur-[20px]"></div>
                  
                  <svg className="w-full h-full -rotate-90 relative z-10">
                    <circle cx="64" cy="64" r="54" fill="none" stroke="#1A1D20" strokeWidth="6" />
                    {/* Dasharray for ~82% of circumference (2 * pi * 54 = 339) -> 339 * 0.82 = 278 */}
                    <circle cx="64" cy="64" r="54" fill="none" stroke="#C9B284" strokeWidth="6" strokeDasharray="339" strokeDashoffset="61" className="drop-shadow-[0_0_10px_rgba(201,178,132,0.4)]" strokeLinecap="round" />
                  </svg>
                  
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                     <span className="text-3xl font-light font-mono text-[#E7D7B0]">82<span className="text-sm ml-0.5">%</span></span>
                     <span className="text-[9px] text-[#8C8370] uppercase mt-1 tracking-widest">High Quality</span>
                  </div>
                </div>
                
                <div className="text-center w-full">
                  <div className="text-[13px] text-[#E7D7B0] font-medium mb-1">记忆完整度高</div>
                  <div className="text-[10px] text-[#8C8370] leading-relaxed">AI 对您的理解较为全面和准确，支持生成高质量战略推演。</div>
                </div>
              </div>

              {/* Context Completeness */}
              <div className="bg-[#121415]/60 border border-[#C9B284]/10 rounded-xl p-6">
                <span className="text-[11px] text-[#A39167] font-mono uppercase tracking-wider block mb-5 font-semibold">上下文完整度 / Context Completeness</span>
                <div className="space-y-4">
                  {[
                    { label: '身份信息', val: 100 },
                    { label: '财富上下文', val: 90 },
                    { label: '投资偏好', val: 85 },
                    { label: '风险偏好', val: 80 },
                    { label: '人生策略', val: 85 },
                    { label: '数据时效性', val: 90 },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-300 w-16 shrink-0">{item.label}</span>
                      <div className="flex-1 h-1 bg-[#1A1D20] rounded-full overflow-hidden relative">
                        <div className="absolute left-0 top-0 h-full bg-[#C9B284]/80 rounded-full" style={{ width: `${item.val}%` }}></div>
                      </div>
                      <span className="text-[10px] font-mono text-[#E7D7B0] w-8 text-right shrink-0">{item.val}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last Updated */}
              <div className="bg-[#121415]/60 border border-[#C9B284]/10 rounded-xl p-6">
                <span className="text-[11px] text-[#A39167] font-mono uppercase tracking-wider block mb-4 font-semibold">最后更新 / Last Updated</span>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#1A1D20] border border-[#C9B284]/20 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-[#C9B284]" />
                  </div>
                  <div>
                    <div className="text-[12px] font-mono text-[#E7D7B0]">
                      {/* Safe fallback formatted date */}
                      {new Date().toISOString().slice(0,10)} 10:42 AM
                    </div>
                    <div className="text-[10px] text-[#8C8370] mt-0.5">由 Arbi AI 自动生成/更新</div>
                  </div>
                </div>
              </div>

              {/* Data Sources */}
              <div className="bg-[#121415]/60 border border-[#C9B284]/10 rounded-xl p-6">
                <span className="text-[11px] text-[#A39167] font-mono uppercase tracking-wider block mb-4 font-semibold">数据来源 / Data Sources</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0E1012] border border-[#1A1D20]">
                     <CheckCircle2 className="w-4 h-4 text-[#C9B284]/70 shrink-0" />
                     <div className="flex flex-col">
                        <div className="text-[11px] text-slate-300 mb-0.5">对话记录</div>
                        <div className="text-[9px] text-[#8C8370] font-mono">100+ Nodes</div>
                     </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0E1012] border border-[#1A1D20]">
                     <Activity className="w-4 h-4 text-[#C9B284]/70 shrink-0" />
                     <div className="flex flex-col">
                        <div className="text-[11px] text-slate-300 mb-0.5">投资组合</div>
                        <div className="text-[9px] text-[#8C8370] font-mono">实时同步</div>
                     </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0E1012] border border-[#1A1D20]">
                     <Globe className="w-4 h-4 text-[#C9B284]/70 shrink-0" />
                     <div className="flex flex-col">
                        <div className="text-[11px] text-slate-300 mb-0.5">市场洞察</div>
                        <div className="text-[9px] text-[#8C8370] font-mono">宏观指标</div>
                     </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0E1012] border border-[#1A1D20]">
                     <Briefcase className="w-4 h-4 text-[#C9B284]/70 shrink-0" />
                     <div className="flex flex-col">
                        <div className="text-[11px] text-slate-300 mb-0.5">外部研究</div>
                        <div className="text-[9px] text-[#8C8370] font-mono">定期刷新</div>
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

