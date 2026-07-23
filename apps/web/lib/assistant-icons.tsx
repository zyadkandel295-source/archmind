import {
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  BriefcaseBusiness,
  Calculator,
  Code2,
  DatabaseZap,
  FileText,
  GraduationCap,
  Headphones,
  Languages,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  Microscope,
  PenTool,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  Target,
  type LucideIcon
} from "lucide-react";

export interface AssistantIconOption {
  value: string;
  label: string;
  Icon: LucideIcon;
}

export const ASSISTANT_ICON_OPTIONS: AssistantIconOption[] = [
  { value: "Bot", label: "General assistant", Icon: Bot },
  { value: "LifeBuoy", label: "Customer support", Icon: LifeBuoy },
  { value: "Headphones", label: "Help desk", Icon: Headphones },
  { value: "MessageCircle", label: "Live chat", Icon: MessageCircle },
  { value: "BookOpen", label: "Knowledge base", Icon: BookOpen },
  { value: "FileText", label: "Document review", Icon: FileText },
  { value: "DatabaseZap", label: "Data assistant", Icon: DatabaseZap },
  { value: "Code2", label: "Code assistant", Icon: Code2 },
  { value: "Calculator", label: "Math solver", Icon: Calculator },
  { value: "GraduationCap", label: "Tutor", Icon: GraduationCap },
  { value: "Languages", label: "Translator", Icon: Languages },
  { value: "PenTool", label: "Writing editor", Icon: PenTool },
  { value: "BarChart3", label: "Analytics", Icon: BarChart3 },
  { value: "Target", label: "Strategy", Icon: Target },
  { value: "BriefcaseBusiness", label: "Business", Icon: BriefcaseBusiness },
  { value: "ShoppingCart", label: "Sales", Icon: ShoppingCart },
  { value: "Megaphone", label: "Marketing", Icon: Megaphone },
  { value: "ShieldCheck", label: "Security", Icon: ShieldCheck },
  { value: "Scale", label: "Legal", Icon: Scale },
  { value: "Stethoscope", label: "Healthcare", Icon: Stethoscope },
  { value: "Microscope", label: "Research", Icon: Microscope },
  { value: "Brain", label: "Reasoning", Icon: Brain }
];

const DEFAULT_ASSISTANT_ICON = ASSISTANT_ICON_OPTIONS[0]!;

export function getAssistantIcon(icon?: string) {
  const normalized = icon === "Sparkles" ? "Bot" : icon;
  return ASSISTANT_ICON_OPTIONS.find((option) => option.value === normalized) ?? DEFAULT_ASSISTANT_ICON;
}
