/**
 * Falas AMBIENTAIS (camada 1, locais, sem LLM): apenas convivência social neutra.
 * Nenhuma fala ambiental afirma progresso de trabalho — falas profissionais são
 * exclusivamente as mensagens reais registradas pelo backend (eventos agent.message).
 */
export const LINES = {
  greet: ['Bom dia!', 'E aí, tudo certo?', 'Olá!', 'Bom te ver por aqui!'],
  reply: ['Tudo ótimo!', 'Indo bem.', 'Bora!', 'Firme e forte.'],
  coffee: ['Vamos tomar um café?', 'Hora do café!', 'Mais um espresso, por favor.'],
  work: ['Como foi o fim de semana?', 'Viu a chuva ontem?', 'Que dia corrido!', 'Bora almoçar mais tarde?'],
  workReply: ['Foi tranquilo.', 'Vi sim!', 'Pois é.', 'Combinado.'],
  research: ['Que calor hoje.', 'Alguém viu meu caderno?', 'Gostei da sala nova.'],
  observe: ['Que vista linda.', 'Hmm…', 'Deixa eu ver.'],
  bye: ['Até já!', 'Valeu!', 'Falamos depois.'],
  robot: ['Bip-bop.', 'Rotina de limpeza.', 'Sistemas nominais.'],
  fun: ['Alguém viu o gato?', 'Pausa rápida!', 'Quem quer café?'],
}

export function pick<T>(arr: readonly T[], rnd: () => number = Math.random): T {
  return arr[Math.floor(rnd() * arr.length)]
}
