export type ParticipantBalance = {
  participantId: string;
  name: string;
  nickname: string | null;
  paid: number;
  expected: number;
  diff: number; // positive = owed money, negative = owes money
};

export type Settlement = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
};

export function computeBalances(
  totalAmount: number,
  paidByParticipant: { participantId: string; name: string; nickname: string | null; sum: number; days: number }[]
): ParticipantBalance[] {
  const totalDays = paidByParticipant.reduce((s, p) => s + Math.max(1, p.days || 1), 0);
  if (totalDays <= 0) {
    const expected = paidByParticipant.length > 0 ? totalAmount / paidByParticipant.length : 0;
    return paidByParticipant.map((p) => ({
      participantId: p.participantId,
      name: p.name,
      nickname: p.nickname,
      paid: p.sum,
      expected,
      diff: p.sum - expected,
    }));
  }
  // Pro-rata: expected_i = totalAmount × (days_i / totalDays) – יחס הימים של כל משתתף לסך הימים
  return paidByParticipant.map((p) => {
    const days = Math.max(1, p.days || 1);
    const expected = (totalAmount * days) / totalDays;
    return {
      participantId: p.participantId,
      name: p.name,
      nickname: p.nickname,
      paid: p.sum,
      expected,
      diff: p.sum - expected,
    };
  });
}

export function computeSettlements(balances: ParticipantBalance[]): Settlement[] {
  const debtors = balances
    .filter((b) => b.diff < -0.01)
    .map((b) => ({ ...b, owes: Math.round(-b.diff * 100) / 100 }));
  const creditors = balances
    .filter((b) => b.diff > 0.01)
    .map((b) => ({ ...b, owed: Math.round(b.diff * 100) / 100 }));

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = Math.min(d.owes, c.owed);
    if (amount >= 0.01) {
      settlements.push({
        fromId: d.participantId,
        fromName: d.nickname || d.name,
        toId: c.participantId,
        toName: c.nickname || c.name,
        amount: Math.round(amount * 100) / 100,
      });
      d.owes = Math.round((d.owes - amount) * 100) / 100;
      c.owed = Math.round((c.owed - amount) * 100) / 100;
    }
    if (d.owes < 0.01) i++;
    if (c.owed < 0.01) j++;
  }

  return settlements;
}
