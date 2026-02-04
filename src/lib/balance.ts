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
  participantCount: number,
  paidByParticipant: { participantId: string; name: string; nickname: string | null; sum: number }[]
): ParticipantBalance[] {
  const expected = participantCount > 0 ? totalAmount / participantCount : 0;
  return paidByParticipant.map((p) => ({
    participantId: p.participantId,
    name: p.name,
    nickname: p.nickname,
    paid: p.sum,
    expected,
    diff: p.sum - expected,
  }));
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
