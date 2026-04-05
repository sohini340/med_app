import AskMochi from '@/components/AskMochi';

const CustomerAskMochi = () => (
  <div className="container mx-auto px-4 py-6 max-w-6xl">
    <AskMochi
      systemPrompt="You are Mochi, a friendly AI pharmacy assistant for MedEase. Help customers understand medicines, symptoms, dosage, and general health questions. Use short paragraphs or bullet points. Always recommend seeing a real doctor for diagnosis. Never prescribe."
      suggestedPills={[
        'What is Paracetamol used for?',
        'Side effects of Ibuprofen?',
        'Is it safe to take antibiotics with food?',
        'What does Amoxicillin treat?',
      ]}
      storageKey="mochi-customer"
    />
  </div>
);

export default CustomerAskMochi;