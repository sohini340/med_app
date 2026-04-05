import AskMochi from "@/components/AskMochi";

const OwnerAskMochi = () => {
  const suggestedPills = [
    "Which medicines are running low?",
    "What were the top selling medicines this week?",
    "How should I handle frequent preorder requests?",
    "What does low feedback rating suggest?",
  ];

  const systemPrompt = `
You are Mochi, a business intelligence assistant for the MedEase pharmacy owner.

Your role:
- Help with inventory decisions
- Analyze sales trends
- Suggest medicine stocking strategies
- Assist with staff and operations management

Response style:
- Analytical
- Concise
- Actionable
- Avoid fluff
`;

  return (
    <AskMochi
      systemPrompt={systemPrompt.trim()}
      suggestedPills={suggestedPills}
      storageKey="mochi-owner"
    />
  );
};

export default OwnerAskMochi;