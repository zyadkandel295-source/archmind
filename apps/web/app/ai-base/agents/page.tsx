import { AIBaseHeader } from "@/components/ai-base/ai-base-header";
import { MathFormulaCard } from "@/components/ai-base/math-formula-card";
import { Terminal, Bot, Cpu, Zap } from "lucide-react";

export const metadata = {
  title: "AI Agents & ReAct Loops | AGENTIA AI BASE",
  description: "Agent Architectures, Planning, Memory, Function Calling, ReAct, Reflection, Multi-Agent Swarms."
};

export default function AgentsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <AIBaseHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="border-b border-slate-800 pb-5">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold mb-2">
            <Terminal className="w-4 h-4" />
            SECTION 06
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
            Autonomous AI Agents & ReAct Architecture
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
            Technical agent loops, tool registration, JSON schema function calling, ReAct reasoning transitions, memory reflection stores, and multi-agent coordination swarms.
          </p>
        </div>

        <MathFormulaCard
          equation="\text{Step}_t = \text{LLM}\left(\text{Prompt} + \sum_{i=1}^{t-1} [T_i, A_i, O_i]\right)"
          latexName="ReAct Agent State Transition Equation"
          variableBreakdown={[
            { variable: "T_i", meaning: "Thought generated at step i" },
            { variable: "A_i", meaning: "Action (tool name & input arguments) selected at step i" },
            { variable: "O_i", meaning: "Observation returned by external tool execution at step i" }
          ]}
          whyItExists="Maintains full state history context across iterative tool interaction turns."
          howDerived="Derived from Markov Decision Process (MDP) observation-action loop formulation."
          numericalExample={{
            input: "Goal: 'Get stock price of AAPL and convert to EUR'",
            stepByStep: "Thought 1: 'I need to fetch AAPL price.' Action 1: get_stock('AAPL') -> Observation 1: '$220 USD'.\nThought 2: 'Now I convert $220 USD to EUR.' Action 2: convert_currency(220, 'USD', 'EUR') -> Observation 2: '201.5 EUR'.",
            output: "Final Answer: 'AAPL stock price is 201.5 EUR.'"
          }}
          pythonCode={`class ReActAgent:
    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = {t.name: t for t in tools}

    def run(self, user_goal, max_steps=10):
        history = [f"Goal: {user_goal}"]
        for step in range(max_steps):
            prompt = "\\n".join(history) + "\\nThought:"
            response = self.llm.generate(prompt)

            if "Final Answer:" in response:
                return response.split("Final Answer:")[1].strip()

            tool_name, tool_input = self.parse_action(response)
            if tool_name in self.tools:
                obs = self.tools[tool_name].execute(tool_input)
                history.append(f"Thought: {response}\\nObservation: {obs}")
        return "Max steps reached."`}
        />
      </main>
    </div>
  );
}
