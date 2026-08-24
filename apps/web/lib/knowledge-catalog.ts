export type KnowledgeDepth = "Foundation" | "Intermediate" | "Advanced" | "Research";

export type KnowledgeField = {
  slug: string;
  title: string;
  summary: string;
  disciplines: string[];
  topics: string[];
  related: string[];
  accent: string;
};

export type KnowledgeResource = {
  id: string;
  slug: string;
  title: string;
  field: KnowledgeField;
  discipline: string;
  topic: string;
  description: string;
  type: "Concept explanation" | "Study guide" | "Research overview";
  difficulty: KnowledgeDepth;
  readingMinutes: number;
  tags: string[];
  prerequisites: string[];
  objectives: string[];
  keyConcepts: string[];
  status: "Educational overview";
  verification: "Source verification required";
};

const field = (
  slug: string,
  title: string,
  summary: string,
  disciplines: string[],
  topics: string[],
  related: string[],
  accent: string
): KnowledgeField => ({ slug, title, summary, disciplines, topics, related, accent });

export const KNOWLEDGE_FIELDS: KnowledgeField[] = [
  field("artificial-intelligence", "Artificial Intelligence", "Intelligent systems, representation, learning, reasoning, and responsible deployment.", ["Foundations", "Machine learning", "Agents"], ["Intelligent systems", "Learning and inference", "Responsible AI"], ["computer-science", "philosophy"], "cyan"),
  field("computer-science", "Computer Science", "Computation, software, algorithms, systems, and the theory that connects them.", ["Algorithms", "Software engineering", "Systems"], ["Algorithms", "Software design", "Distributed systems"], ["mathematics", "engineering"], "blue"),
  field("mathematics", "Mathematics", "Structure, proof, quantity, uncertainty, and formal reasoning across the sciences.", ["Algebra", "Calculus", "Probability"], ["Functions and proof", "Change and optimization", "Uncertainty"], ["physics", "data-science-statistics"], "indigo"),
  field("physics", "Physics", "Matter, energy, motion, fields, and the laws used to describe the physical world.", ["Mechanics", "Electromagnetism", "Modern physics"], ["Motion", "Forces and fields", "Quantum phenomena"], ["mathematics", "astronomy"], "violet"),
  field("astronomy", "Astronomy", "Stars, galaxies, planetary systems, and the observable universe.", ["Planetary science", "Stellar astronomy", "Cosmology"], ["Solar systems", "Stars and galaxies", "Origins of the universe"], ["physics", "earth-science"], "sky"),
  field("chemistry", "Chemistry", "Composition, structure, transformations, and properties of matter.", ["General chemistry", "Organic chemistry", "Physical chemistry"], ["Atoms and bonding", "Chemical reactions", "Molecular structure"], ["biology", "medicine-health-sciences"], "emerald"),
  field("biology", "Biology", "Living systems from cells and genes to organisms, ecosystems, and evolution.", ["Cell biology", "Genetics", "Ecology"], ["Cells", "Inheritance", "Living systems"], ["chemistry", "environmental-science"], "green"),
  field("medicine-health-sciences", "Medicine & Health Sciences", "Health, disease, prevention, clinical evidence, and care systems.", ["Anatomy", "Public health", "Clinical research"], ["Human health", "Evidence and diagnosis", "Prevention"], ["biology", "psychology"], "rose"),
  field("engineering", "Engineering", "Designing safe, useful systems under real constraints.", ["Mechanical", "Electrical", "Civil"], ["Design process", "Systems and trade-offs", "Safety and reliability"], ["physics", "computer-science"], "orange"),
  field("data-science-statistics", "Data Science & Statistics", "Evidence, measurement, uncertainty, data quality, and decisions.", ["Statistics", "Data analysis", "Visualization"], ["Data and measurement", "Inference", "Communicating evidence"], ["mathematics", "economics"], "teal"),
  field("economics", "Economics", "Choices, incentives, markets, institutions, and distribution under scarcity.", ["Microeconomics", "Macroeconomics", "Development"], ["Incentives", "Markets", "Economic policy"], ["data-science-statistics", "political-science"], "amber"),
  field("business-entrepreneurship", "Business & Entrepreneurship", "Creating value, organizing work, serving customers, and building durable ventures.", ["Strategy", "Operations", "Entrepreneurship"], ["Value creation", "Business systems", "Venture design"], ["economics", "psychology"], "yellow"),
  field("psychology", "Psychology", "Mind, behavior, development, cognition, and the methods used to study people.", ["Cognitive psychology", "Development", "Social psychology"], ["Thinking and memory", "Behavior", "Research methods"], ["biology", "sociology"], "pink"),
  field("sociology", "Sociology", "Social groups, institutions, inequality, culture, and collective change.", ["Social theory", "Institutions", "Population studies"], ["Social structure", "Culture and identity", "Social change"], ["psychology", "political-science"], "fuchsia"),
  field("political-science", "Political Science", "Power, governance, political behavior, institutions, and public life.", ["Comparative politics", "International relations", "Political theory"], ["Institutions", "Political participation", "Global governance"], ["law-public-policy", "economics"], "red"),
  field("law-public-policy", "Law & Public Policy", "Rules, rights, institutions, and evidence-informed public decisions.", ["Legal systems", "Public policy", "Regulation"], ["Legal reasoning", "Policy design", "Rights and institutions"], ["political-science", "economics"], "slate"),
  field("environmental-science", "Environmental Science", "Earth systems, human impact, ecosystems, and environmental decisions.", ["Climate", "Conservation", "Sustainability"], ["Earth systems", "Environmental change", "Sustainable choices"], ["earth-science", "economics"], "lime"),
  field("earth-science", "Earth Science", "The planet's materials, processes, history, hazards, and changing surface.", ["Geology", "Meteorology", "Ocean science"], ["Rocks and time", "Weather and climate", "Planetary processes"], ["environmental-science", "astronomy"], "stone"),
  field("history", "History", "Evidence-based study of change, continuity, people, institutions, and the past.", ["World history", "Social history", "Historical methods"], ["Sources and evidence", "Change over time", "Historical interpretation"], ["philosophy", "political-science"], "orange"),
  field("philosophy", "Philosophy", "Questions about knowledge, reality, ethics, reasoning, and how to live.", ["Ethics", "Epistemology", "Logic"], ["Arguments and reasons", "Knowledge", "Ethical questions"], ["history", "artificial-intelligence"], "purple"),
  field("literature", "Literature", "Texts, forms, interpretation, narrative, and cultural expression.", ["Literary analysis", "World literature", "Writing"], ["Reading closely", "Narrative and form", "Interpretation"], ["history", "languages-linguistics"], "rose"),
  field("languages-linguistics", "Languages & Linguistics", "Language structure, meaning, use, acquisition, and communication across communities.", ["Linguistics", "Language learning", "Discourse"], ["Sounds and structure", "Meaning", "Language in society"], ["literature", "psychology"], "cyan"),
  field("education", "Education", "Learning, teaching, assessment, curriculum, and equitable learning environments.", ["Learning sciences", "Pedagogy", "Assessment"], ["How people learn", "Teaching design", "Feedback and assessment"], ["psychology", "sociology"], "blue"),
  field("interdisciplinary-research", "Interdisciplinary Research", "Methods for connecting evidence, concepts, and methods across fields.", ["Research design", "Systems thinking", "Ethics"], ["Framing questions", "Combining methods", "Research integrity"], ["artificial-intelligence", "environmental-science"], "violet")
];

function titleCase(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getKnowledgeField(slug: string) {
  return KNOWLEDGE_FIELDS.find((item) => item.slug === slug);
}

export function getFieldResources(current: KnowledgeField): KnowledgeResource[] {
  return current.topics.map((topic, index) => {
    const topicSlug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const type: KnowledgeResource["type"] = index === 0 ? "Concept explanation" : index === 1 ? "Study guide" : "Research overview";
    const discipline = current.disciplines[index] ?? current.disciplines[0] ?? current.title;
    return {
      id: `${current.slug}:${topicSlug}`,
      slug: topicSlug,
      title: `${topic}: a structured introduction`,
      field: current,
      discipline,
      topic,
      description: `A four-level learning resource for ${topic.toLowerCase()} in ${current.title}, connecting first principles, applications, limitations, and questions for further study.`,
      type,
      difficulty: index === 2 ? "Research" : index === 1 ? "Intermediate" : "Foundation",
      readingMinutes: 8 + index * 4,
      tags: [current.title, discipline, topic],
      prerequisites: index === 0 ? ["Curiosity and careful reading"] : [current.topics[0] ?? "Foundation concepts", "Basic evidence evaluation"],
      objectives: [
        `Explain the central ideas in ${topic.toLowerCase()} using precise everyday language.`,
        `Connect ${topic.toLowerCase()} to a practical question in ${current.title}.`,
        "Identify what evidence would strengthen or limit a conclusion."
      ],
      keyConcepts: [topic, discipline, "Evidence", "Limitations"],
      status: "Educational overview",
      verification: "Source verification required"
    };
  });
}

export function findKnowledgeResource(fieldSlug: string, resourceSlug: string) {
  const current = getKnowledgeField(fieldSlug);
  return current ? getFieldResources(current).find((resource) => resource.slug === resourceSlug) : undefined;
}

export function getAllKnowledgeResources() {
  return KNOWLEDGE_FIELDS.flatMap(getFieldResources);
}

export function getDepthContent(resource: KnowledgeResource, depth: KnowledgeDepth) {
  const subject = resource.topic.toLowerCase();
  const fieldName = resource.field.title;
  const levels: Record<KnowledgeDepth, { heading: string; body: string; prompts: string[] }> = {
    Foundation: {
      heading: `Start with the essential idea of ${subject}`,
      body: `${resource.topic} is a useful lens for asking clear questions in ${fieldName}. Begin by naming what is being studied, what changes, and what counts as a good explanation. A strong first understanding should separate observations from interpretations and connect new vocabulary to an everyday example.`,
      prompts: ["What is the simplest useful definition?", "What is one concrete example?", "Which idea should I learn next?"]
    },
    Intermediate: {
      heading: `Connect concepts, mechanisms, and applications`,
      body: `At an intermediate level, ${subject} is best understood as a set of relationships rather than a list of terms. Compare alternative explanations, identify assumptions, and trace how evidence is collected or evaluated. Apply the concepts to a realistic case, then test whether the conclusion changes when important conditions change.`,
      prompts: ["Walk through a worked example.", "Compare two interpretations.", "What assumptions matter here?"]
    },
    Advanced: {
      heading: `Analyze the structure and limits of the topic`,
      body: `Advanced study of ${subject} requires operational definitions, explicit methods, and careful attention to uncertainty. Ask how the field measures key variables, what a result can and cannot establish, and whether a proposed explanation generalizes beyond its original setting. Where quantitative or formal tools apply, state the assumptions before using them.`,
      prompts: ["Show the formal reasoning.", "What are the main failure modes?", "How would an expert evaluate this claim?"]
    },
    Research: {
      heading: `Frame a researchable question`,
      body: `Research on ${subject} begins with a bounded question, a justified method, and an honest account of limitations. Distinguish established findings from active debate, inference, and unverified claims. This overview does not assert external citations; use the source-verification workflow before relying on a reference, statistic, or historical claim in academic work.`,
      prompts: ["Help me formulate a research question.", "Compare possible methods.", "What evidence would be needed to verify a source?"]
    }
  };
  return levels[depth];
}

export function formatFieldTitle(slug: string) {
  return getKnowledgeField(slug)?.title ?? titleCase(slug);
}
