import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Wallet, AlertCircle, TrendingUp, Settings, 
  ChevronLeft, ChevronRight, Calendar, Copy, Save, Trash2
} from 'lucide-react';

// ============================================================================
// PARTE 1: LÓGICA DE NEGÓCIO E UTILITÁRIOS
// (Aqui estão as regras do "Schema" que mencionei, já embutidas)
// ============================================================================

// Gera chave única para o mês (ex: "2025-10")
const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

// Formata data para exibição (ex: "Outubro 2025")
const formatMonthDisplay = (date) => {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
};

// Formata dinheiro (R$)
const formatMoney = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// ============================================================================
// PARTE 2: COMPONENTES VISUAIS (DESIGN SYSTEM)
// (Botões, Cartões e Caixas de Texto bonitos)
// ============================================================================

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-5 ${className}`}>
    {children}
  </div>
);

const Button = ({ onClick, children, variant = 'primary', className = "", disabled=false }) => {
  const baseStyle = "w-full py-3.5 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 shadow-md active:scale-95",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95",
    ghost: "bg-transparent text-emerald-600 hover:bg-emerald-50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100"
  };
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-slate-600 mb-1.5 ml-1">{label}</label>
    <input 
      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-slate-800 bg-slate-50 focus:bg-white"
      {...props}
    />
  </div>
);

// ============================================================================
// PARTE 3: O APLICATIVO EM SI (CÓDIGO PRINCIPAL)
// ============================================================================

export default function ZeroBudgetApp() {
  
  // --- BANCO DE DADOS NA MEMÓRIA ---
  // Aqui é onde o tal "Schema" vive na prática
  
  const [categories, setCategories] = useState([]); // Categorias (Lazer, Mercado...)
  const [recurringExpenses, setRecurringExpenses] = useState([]); // Gastos Fixos (Aluguel...)
  const [monthlyLedgers, setMonthlyLedgers] = useState({}); // Dados de cada mês (Renda, Sobra)
  const [transactions, setTransactions] = useState([]); // Todas as despesas já feitas
  
  // --- CONTROLE DA TELA ---
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [view, setView] = useState('dashboard'); // Controla qual tela aparece
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Variáveis auxiliares
  const currentMonthKey = getMonthKey(currentDate);
  const currentLedger = monthlyLedgers[currentMonthKey]; // Pega os dados SÓ deste mês atual

  // --- SALVAMENTO AUTOMÁTICO (Persistência) ---
  // Isso garante que se você fechar e abrir de novo, os dados continuam lá
  useEffect(() => {
    const savedData = localStorage.getItem('zeroBudget_MVP_v1');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setCategories(parsed.categories || []);
      setRecurringExpenses(parsed.recurringExpenses || []);
      setMonthlyLedgers(parsed.monthlyLedgers || {});
      setTransactions(parsed.transactions || []);
    }
    setIsFirstLoad(false);
  }, []);

  useEffect(() => {
    if (!isFirstLoad) {
      localStorage.setItem('zeroBudget_MVP_v1', JSON.stringify({
        categories,
        recurringExpenses,
        monthlyLedgers,
        transactions
      }));
    }
  }, [categories, recurringExpenses, monthlyLedgers, transactions, isFirstLoad]);

  // --- INTELIGÊNCIA DO APP (SERVICES) ---

  // 1. Descobrir se sobrou dinheiro do mês passado
  const calculateRollover = (targetMonthKey) => {
    // Matemática de data para achar o mês anterior
    const [year, month] = targetMonthKey.split('-').map(Number);
    const prevDate = new Date(year, month - 2); 
    const prevKey = getMonthKey(prevDate);
    
    // Busca dados do mês anterior
    const prevLedger = monthlyLedgers[prevKey];

    if (!prevLedger) return 0; // Se não tem mês anterior, sobra é 0

    // Soma tudo que gastou no mês anterior
    const prevExpenses = transactions
      .filter(t => t.monthKey === prevKey)
      .reduce((acc, t) => acc + Number(t.amount), 0);

    // Sobra = (Renda + O que sobrou do outro mês) - Gastos
    const balance = (prevLedger.income + prevLedger.rollover) - prevExpenses;
    return Math.max(0, balance); // Só retorna valor positivo
  };

  // 2. Criar um Novo Mês (A Mágica da Automação)
  const startNewMonth = (incomeInput, rolloverInput) => {
    // Define a renda deste mês novo
    const newLedger = {
      income: Number(incomeInput),
      rollover: Number(rolloverInput),
      status: 'OPEN'
    };

    // Salva a renda no banco
    setMonthlyLedgers(prev => ({
      ...prev,
      [currentMonthKey]: newLedger
    }));

    // PEGA OS GASTOS FIXOS E CRIA SOZINHO (Aqui está a automação!)
    const autoTransactions = recurringExpenses.map(model => ({
      id: Date.now() + Math.random().toString(), // ID único
      monthKey: currentMonthKey,
      categoryId: model.categoryId,
      amount: model.amount,
      description: `${model.name} (Fixo Recorrente)`,
      date: new Date().toISOString(),
      isFixed: true
    }));

    // Adiciona essas despesas automáticas na lista
    setTransactions(prev => [...prev, ...autoTransactions]);
    
    // Volta pra tela principal
    setView('dashboard');
  };

  // --- CÁLCULOS DE TELA ---

  const currentTransactions = useMemo(() => {
    return transactions.filter(t => t.monthKey === currentMonthKey);
  }, [transactions, currentMonthKey]);

  const getSpentByCategory = (categoryId) => {
    return currentTransactions
      .filter(t => t.categoryId === categoryId)
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
  };

  const totalSpent = currentTransactions.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalAvailable = (currentLedger?.income || 0) + (currentLedger?.rollover || 0);
  const remainingBalance = totalAvailable - totalSpent;

  // --- INTERAÇÕES DO USUÁRIO ---

  const handleMonthChange = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
    // Ao mudar de mês, o App vai checar sozinho se o mês existe.
    // Se não existir, vai cair na tela de "Criar Mês" automaticamente.
  };

  const handleCreateCategory = (e) => {
    e.preventDefault();
    const newCat = {
      id: Date.now().toString(),
      name: e.target.name.value,
      limit: Number(e.target.limit.value)
    };
    setCategories([...categories, newCat]);
    e.target.reset();
  };

  const handleCreateRecurring = (e) => {
    e.preventDefault();
    const newRec = {
      id: Date.now().toString(),
      name: e.target.name.value,
      amount: Number(e.target.amount.value),
      categoryId: e.target.category.value
    };
    setRecurringExpenses([...recurringExpenses, newRec]);
    e.target.reset();
  };

  // --- TELAS (VIEWS) ---

  // TELA 1: CONFIGURAR NOVO MÊS (Aparece se o mês não existe)
  if (!currentLedger && view !== 'settings') {
    const projectedRollover = calculateRollover(currentMonthKey);
    
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <Calendar className="w-16 h-16 text-emerald-600 mx-auto mb-4 bg-emerald-100 p-4 rounded-2xl" />
            <h1 className="text-2xl font-bold text-slate-800">Planejar {formatMonthDisplay(currentDate)}</h1>
            <p className="text-slate-500 mt-2">Vamos configurar o orçamento deste mês.</p>
          </div>

          <Card>
            <form onSubmit={(e) => {
              e.preventDefault();
              startNewMonth(e.target.income.value, projectedRollover);
            }}>
              
              {/* Card de Sobra do Mês Anterior */}
              {projectedRollover > 0 && (
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6 flex items-start gap-3">
                  <div className="text-blue-500 mt-1"><Wallet size={20}/></div>
                  <div>
                    <p className="text-sm font-semibold text-blue-700">Sobrou do mês passado!</p>
                    <p className="text-lg font-bold text-blue-800">{formatMoney(projectedRollover)}</p>
                    <p className="text-xs text-blue-600">Este valor será somado à sua renda.</p>
                  </div>
                </div>
              )}

              <Input 
                label="Qual sua Renda/Salário este mês?" 
                name="income" 
                type="number" 
                placeholder="0.00" 
                autoFocus
                required
              />

              {recurringExpenses.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-xl mb-6 border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Automação</p>
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <Copy size={16} />
                    <span>Lançaremos <b>{recurringExpenses.length} gastos fixos</b> automaticamente.</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => handleMonthChange(-1)} type="button">Voltar Mês</Button>
                <Button type="submit">Iniciar Mês</Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  // TELA 2: CONFIGURAÇÕES (Categorias e Fixos)
  if (view === 'settings') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 pb-24">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView('dashboard')} className="p-2 bg-white rounded-full shadow-sm"><ChevronLeft size={20}/></button>
            <h2 className="text-xl font-bold text-slate-800">Ajustes Globais</h2>
          </div>

          <div className="space-y-6">
            {/* Seção Categorias */}
            <section>
              <h3 className="font-semibold text-slate-600 mb-3 ml-1">1. Categorias (Budget)</h3>
              <Card>
                <form onSubmit={handleCreateCategory} className="mb-4">
                  <div className="flex gap-2">
                    <input name="name" placeholder="Nome (Ex: Lazer)" className="flex-1 px-3 py-2 border rounded-lg text-sm" required />
                    <input name="limit" type="number" placeholder="Teto R$" className="w-24 px-3 py-2 border rounded-lg text-sm" required />
                    <button className="bg-emerald-600 text-white p-2 rounded-lg"><Plus size={18}/></button>
                  </div>
                </form>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex justify-between text-sm py-2 border-b border-slate-50 last:border-0">
                      <span>{cat.name}</span>
                      <span className="font-medium text-slate-500">{formatMoney(cat.limit)}</span>
                    </div>
                  ))}
                  {categories.length === 0 && <p className="text-xs text-slate-400 text-center">Nenhuma categoria criada.</p>}
                </div>
              </Card>
            </section>

            {/* Seção Modelos Fixos */}
            <section>
              <h3 className="font-semibold text-slate-600 mb-3 ml-1">2. Gastos Fixos Recorrentes</h3>
              <p className="text-xs text-slate-400 mb-2 ml-1">Estes gastos aparecerão automaticamente todo mês novo.</p>
              <Card>
                {categories.length === 0 ? (
                   <p className="text-sm text-red-400 text-center py-2">Crie categorias primeiro.</p>
                ) : (
                  <form onSubmit={handleCreateRecurring} className="mb-4 space-y-2">
                    <input name="name" placeholder="Nome (Ex: Aluguel)" className="w-full px-3 py-2 border rounded-lg text-sm" required />
                    <div className="flex gap-2">
                      <input name="amount" type="number" placeholder="Valor" className="w-24 px-3 py-2 border rounded-lg text-sm" required />
                      <select name="category" className="flex-1 px-3 py-2 border rounded-lg text-sm bg-white" required>
                        <option value="">Categoria...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button className="bg-indigo-600 text-white p-2 rounded-lg"><Save size={18}/></button>
                    </div>
                  </form>
                )}
                <div className="space-y-2">
                  {recurringExpenses.map(rec => (
                    <div key={rec.id} className="flex justify-between items-center text-sm py-2 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                         <span>{rec.name}</span>
                      </div>
                      <span className="font-bold text-slate-600">{formatMoney(rec.amount)}</span>
                    </div>
                  ))}
                  {recurringExpenses.length === 0 && <p className="text-xs text-slate-400 text-center">Nenhum fixo cadastrado.</p>}
                </div>
              </Card>
            </section>
            
            <button 
              onClick={() => {
                if(confirm("Tem certeza? Isso apaga TUDO e reinicia o app.")) { localStorage.clear(); window.location.reload(); }
              }}
              className="text-red-500 text-sm w-full text-center py-4 border border-red-100 rounded-xl hover:bg-red-50"
            >
              <Trash2 size={16} className="inline mr-2"/>
              Resetar Aplicativo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // TELA 3: ADICIONAR DESPESA
  if (view === 'add-transaction') {
     return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-3xl p-6 animate-in slide-in-from-bottom-10 fade-in">
                <h3 className="text-xl font-bold mb-4 text-slate-800">Nova Despesa</h3>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const newTrans = {
                        id: Date.now().toString(),
                        monthKey: currentMonthKey,
                        categoryId: e.target.category.value,
                        amount: Number(e.target.amount.value),
                        date: new Date().toISOString()
                    };
                    setTransactions([...transactions, newTrans]);
                    setView('dashboard');
                }}>
                    <Input name="amount" type="number" step="0.01" label="Valor Gasto" autoFocus placeholder="0.00" required />
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-600 mb-1.5 ml-1">Categoria</label>
                        <select name="category" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white" required>
                             <option value="">Selecione...</option>
                             {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="secondary" onClick={() => setView('dashboard')}>Cancelar</Button>
                        <Button type="submit">Salvar Gasto</Button>
                    </div>
                </form>
            </div>
        </div>
     )
  }

  // TELA 4: DASHBOARD (PRINCIPAL)
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* CABEÇALHO ESCURO */}
      <div className="bg-slate-900 pt-10 pb-20 px-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="max-w-md mx-auto relative z-10 text-white">
          
          {/* Navegador de Meses */}
          <div className="flex items-center justify-between mb-6">
             <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-white/10 rounded-full"><ChevronLeft /></button>
             <h2 className="text-lg font-medium flex items-center gap-2">
                <Calendar size={18} className="opacity-70"/>
                {formatMonthDisplay(currentDate)}
             </h2>
             <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-white/10 rounded-full"><ChevronRight /></button>
          </div>

          {/* Saldo Grande */}
          <div className="text-center mb-6">
             <p className="text-white/60 text-sm font-medium mb-1">Disponível (Renda + Sobras)</p>
             <h1 className="text-4xl font-bold tracking-tight">{formatMoney(totalAvailable)}</h1>
          </div>

          {/* Cards Rápidos */}
          <div className="grid grid-cols-2 gap-3">
             <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                <p className="text-xs text-emerald-300 uppercase font-bold tracking-wide mb-1">Restante</p>
                <p className={`text-xl font-semibold ${remainingBalance < 0 ? 'text-red-400' : 'text-white'}`}>
                    {formatMoney(remainingBalance)}
                </p>
             </div>
             <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/20 transition-colors"
                onClick={() => setView('settings')}
             >
                <div>
                    <p className="text-xs text-indigo-300 uppercase font-bold tracking-wide mb-1">Configurar</p>
                    <p className="text-sm font-medium text-white/90">Categorias & Fixos</p>
                </div>
                <Settings size={18} className="text-white/50" />
             </div>
          </div>
        </div>
      </div>

      {/* LISTA DE CATEGORIAS (Corpo) */}
      <div className="max-w-md mx-auto px-6 -mt-10 relative z-20">
         <div className="space-y-3">
            {categories.map(cat => {
               const spent = getSpentByCategory(cat.id);
               const percentage = Math.min((spent / cat.limit) * 100, 100);
               const isOver = spent > cat.limit;
               
               return (
                   <Card key={cat.id} className="py-4 px-5">
                       <div className="flex justify-between mb-2">
                           <span className="font-semibold text-slate-700">{cat.name}</span>
                           <span className={`text-sm font-bold ${isOver ? 'text-red-500' : 'text-slate-600'}`}>
                               {formatMoney(spent)} <span className="text-slate-400 font-normal">/ {cat.limit}</span>
                           </span>
                       </div>
                       {/* Barra de Progresso */}
                       <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                           <div 
                               className={`h-full transition-all duration-500 ${isOver ? 'bg-red-500' : 'bg-emerald-500'}`} 
                               style={{ width: `${percentage}%` }}
                           />
                       </div>
                   </Card>
               )
            })}
            
            {categories.length === 0 && (
                <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                    <p>Você ainda não configurou categorias.</p>
                    <button onClick={() => setView('settings')} className="text-emerald-600 font-bold mt-2 hover:underline">Configurar Agora</button>
                </div>
            )}
         </div>
      </div>

      {/* BOTÃO FLUTUANTE (Adicionar Gasto) */}
      {categories.length > 0 && (
          <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
            <button 
                onClick={() => setView('add-transaction')}
                className="pointer-events-auto bg-slate-900 text-white flex items-center gap-2 px-6 py-4 rounded-full shadow-xl shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all font-semibold"
            >
                <Plus size={20} />
                <span>Nova Despesa</span>
            </button>
          </div>
      )}
    </div>
  );
}