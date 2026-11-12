/**
 * Diálogos AMBIENTAIS pré-definidos (locais, sem LLM).
 * Mensagens profissionais reais virão de eventos do backend (Fase 4/5).
 */
export const LINES = {
  greet: ['Bom dia!', 'E aí, tudo certo?', 'Oi! Como vai o projeto?', 'Olá, equipe!', 'Bom te ver por aqui!'],
  reply: ['Tudo ótimo!', 'Correria, mas indo bem.', 'Melhor agora!', 'Bora!', 'Firme e forte.'],
  coffee: ['Vamos tomar um café?', 'Hora do café!', 'Esse café está ótimo.', 'Mais um espresso, por favor.'],
  work: ['Pode me ajudar com isso?', 'Preciso revisar um resultado.', 'Achei algo interessante nos dados.', 'Vamos parear nessa parte?', 'Tenho uma ideia para o pipeline.'],
  workReply: ['Claro, me mostra.', 'Vou dar uma olhada.', 'Boa! Anota no quadro.', 'Faz sentido, vamos testar.', 'Depois do café eu vejo.'],
  research: ['O experimento funcionou!', 'Esse artigo é muito bom.', 'Os embeddings melhoraram.', 'Precisamos de mais amostras.', 'Vamos comparar com o baseline?'],
  observe: ['Que vista linda.', 'Interessante…', 'Hmm, deixa eu ver.', 'Os indicadores estão estáveis.'],
  done: ['Concluí minha análise!', 'Entrega pronta!', 'Missão cumprida!', 'Fluxo pronto para execução!'],
  bye: ['Até já!', 'Valeu!', 'Falamos depois.', 'Bom trabalho!'],
  robot: ['Bip-bop. Recarga em 87%.', 'Entregando suprimentos.', 'Rotina verificada.', 'Sistemas nominais.'],
  fun: ['Alguém viu o gato?', 'Pausa rápida!', 'Hoje o código compilou de primeira!', 'Quem quer jogar xadrez depois?'],
}

/** Mensagens operacionais DEMONSTRATIVAS (marcadas como demo na interface). */
export const DEMO_PRO_LINES = [
  'Encontrei três estudos relevantes.',
  'Vou comparar os resultados.',
  'Identifiquei uma inconsistência.',
  'Os dados de vendas estão consolidados.',
  'Posso revisar o relatório agora.',
  'O modelo convergiu na última rodada.',
]

export function pick<T>(arr: readonly T[], rnd: () => number = Math.random): T {
  return arr[Math.floor(rnd() * arr.length)]
}
