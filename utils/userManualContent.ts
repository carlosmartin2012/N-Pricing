import type { Language } from '../translations';

export interface ManualStep {
  title: string;
  description: string;
}

export interface ManualWorkflow {
  title: string;
  audience: string;
  steps: string[];
}

export interface ManualModeGuide {
  title: string;
  bullets: string[];
}

export interface UserManualContent {
  hero: {
    title: string;
    subtitle: string;
  };
  quickStart: ManualStep[];
  workflows: ManualWorkflow[];
  dataModes: {
    demo: ManualModeGuide;
    live: ManualModeGuide;
  };
  troubleshooting: ManualStep[];
  supportChecklist: string[];
}

const CONTENT: Record<Language, UserManualContent> = {
  es: {
    hero: {
      title: 'N Pricing — manual operativo',
      subtitle:
        'Guía práctica para entender el flujo de trabajo, empezar rápido y operar la herramienta con menos fricción.',
    },
    quickStart: [
      {
        title: '1. Elige el modo correcto de trabajo',
        description:
          'Empieza en el módulo adecuado: Pricing para cotizar, Blotter para workflow, Reporting para cartera y Config para reglas y datos maestros.',
      },
      {
        title: '2. Parte de una operación o escenario',
        description:
          'Crea un deal nuevo o reutiliza una operación existente para recalcular, comparar y revisar impacto.',
      },
      {
        title: '3. Revisa inputs críticos antes del precio final',
        description:
          'Valida cliente, producto, importe, plazo, margen objetivo, flags regulatorios y cualquier parámetro ESG relevante.',
      },
      {
        title: '4. Lee waterfall y RAROC juntos',
        description:
          'No te quedes solo con el tipo final: interpreta la metodología aplicada, el waterfall y el nivel de aprobación requerido.',
      },
      {
        title: '5. Lleva la operación al workflow correcto',
        description:
          'Guarda la operación, revísala en blotter y usa snapshots/dossiers cuando necesites contexto para comité o seguimiento.',
      },
    ],
    workflows: [
      {
        title: 'Workflow 1 — Pricing de una operación nueva',
        audience: 'Front office / structuring',
        steps: [
          'Entrar en Pricing Engine y partir de una operación nueva.',
          'Configurar cliente, producto, importe, plazo y parámetros adicionales.',
          'Revisar waterfall, final rate, RAROC y approval level.',
          'Guardar la operación y moverla al flujo de revisión si aplica.',
        ],
      },
      {
        title: 'Workflow 2 — Revisión en blotter y aprobación',
        audience: 'Middle office / governance',
        steps: [
          'Abrir la operación en Deal Blotter y validar su estado.',
          'Revisar evidencias, snapshot y artefactos vinculados.',
          'Contrastar con cartera o reporting si hace falta contexto.',
          'Aprobar, rechazar o devolver a draft según política vigente.',
        ],
      },
      {
        title: 'Workflow 3 — Reporting y comité',
        audience: 'Management / ALM / committee',
        steps: [
          'Entrar en Reporting y empezar por la vista Overview / Executive.',
          'Revisar rentabilidad, weighted RAROC y operaciones bajo floor.',
          'Congelar un portfolio snapshot cuando haga falta trazabilidad.',
          'Exportar artefactos para comité o auditoría.',
        ],
      },
      {
        title: 'Workflow 4 — Curvas, market data y configuración',
        audience: 'Treasury / admin / model owner',
        steps: [
          'Actualizar curvas o fuentes de mercado antes de cambios materiales.',
          'Mantener reglas, grids y master data desde configuración.',
          'Versionar metodología cuando cambian reglas relevantes.',
          'Validar el impacto posterior en pricing y reporting.',
        ],
      },
    ],
    dataModes: {
      demo: {
        title: 'Modo DEMO',
        bullets: [
          'Úsalo para formación, walkthroughs y demos.',
          'Sirve para enseñar el flujo de trabajo sin depender de contexto operativo.',
          'No lo tomes como fuente de verdad para decisiones reales.',
        ],
      },
      live: {
        title: 'Modo LIVE',
        bullets: [
          'Úsalo cuando trabajes con datos y workflow reales.',
          'Es el modo correcto para colaboración y seguimiento operativo.',
          'Antes de tocar datos críticos, confirma el entorno activo.',
        ],
      },
    },
    troubleshooting: [
      {
        title: 'No sé qué pantalla usar',
        description:
          'Pricing Engine para cotizar, Blotter para workflow, Reporting para cartera y Config para gobierno del motor.',
      },
      {
        title: 'El precio no me cuadra',
        description:
          'Valida inputs, metodología, curvas, grids ESG, shocks activos y umbrales de aprobación antes de concluir.',
      },
      {
        title: 'Necesito contexto para comité',
        description:
          'Acompaña la operación con snapshot, dossier u otros artefactos de evidencia.',
      },
      {
        title: 'Veo resultados inesperados',
        description:
          'Repite el caso con los mismos inputs y compara en blotter/reporting para aislar si es problema de datos o de interpretación.',
      },
    ],
    supportChecklist: [
      'Indica el módulo exacto donde estás trabajando.',
      'Comparte deal ID o referencia equivalente si existe.',
      'Aclara si el problema es de datos, workflow o interpretación del pricing.',
      'Explica qué esperabas ver y qué estás viendo realmente.',
    ],
  },
  en: {
    hero: {
      title: 'N Pricing — operating manual',
      subtitle:
        'Practical guidance to understand the workflow, get started faster, and operate the platform with less friction.',
    },
    quickStart: [
      {
        title: '1. Pick the right working mode',
        description:
          'Start from the right module: Pricing for quoting, Blotter for workflow, Reporting for portfolio review, and Config for rules/master data.',
      },
      {
        title: '2. Start from a deal or scenario',
        description:
          'Create a new deal or reuse an existing one to recalculate, compare and inspect impact.',
      },
      {
        title: '3. Review critical inputs before trusting the final price',
        description:
          'Validate client, product, amount, tenor, target margin, regulatory flags and relevant ESG parameters.',
      },
      {
        title: '4. Read waterfall and RAROC together',
        description:
          'Do not stop at the final rate: interpret the applied methodology, waterfall and required approval level.',
      },
      {
        title: '5. Move the deal into the proper workflow',
        description:
          'Save the deal, review it in the blotter and use governed artifacts when committee context is needed.',
      },
    ],
    workflows: [
      {
        title: 'Workflow 1 — New deal pricing',
        audience: 'Front office / structuring',
        steps: [
          'Open Pricing Engine and start from a new deal.',
          'Configure client, product, amount, tenor and additional parameters.',
          'Review waterfall, final rate, RAROC and approval level.',
          'Save the result and move it into review when required.',
        ],
      },
      {
        title: 'Workflow 2 — Blotter review and approval',
        audience: 'Middle office / governance',
        steps: [
          'Open the deal in Deal Blotter and validate its state.',
          'Review evidence, snapshot and linked artifacts.',
          'Cross-check against reporting or portfolio context when needed.',
          'Approve, reject or send back to draft based on policy.',
        ],
      },
      {
        title: 'Workflow 3 — Reporting and committee review',
        audience: 'Management / ALM / committee',
        steps: [
          'Go to Reporting and start from the Overview / Executive view.',
          'Review profitability, weighted RAROC and below-floor deals.',
          'Freeze a portfolio snapshot when traceability matters.',
          'Export governed artifacts for committee or audit.',
        ],
      },
      {
        title: 'Workflow 4 — Market data and configuration governance',
        audience: 'Treasury / admin / model owner',
        steps: [
          'Refresh curves or market sources before material changes.',
          'Maintain rules, grids and master data from configuration.',
          'Version methodology when material rules change.',
          'Validate the downstream impact in pricing and reporting.',
        ],
      },
    ],
    dataModes: {
      demo: {
        title: 'DEMO mode',
        bullets: [
          'Use it for training, walkthroughs and demos.',
          'Useful for showcasing workflow without depending on live operational context.',
          'Do not treat it as the source of truth for real decisions.',
        ],
      },
      live: {
        title: 'LIVE mode',
        bullets: [
          'Use it when working with real data and workflow.',
          'This is the right mode for collaboration and operational follow-through.',
          'Before changing critical data, confirm the active environment.',
        ],
      },
    },
    troubleshooting: [
      {
        title: 'I am not sure which screen to use',
        description:
          'Use Pricing Engine for quoting, Blotter for workflow, Reporting for portfolio review and Config for engine governance.',
      },
      {
        title: 'The price does not look right',
        description:
          'Validate inputs, methodology, curves, ESG grids, active shocks and approval thresholds before concluding.',
      },
      {
        title: 'I need committee-ready context',
        description:
          'Attach the deal to a snapshot, dossier or equivalent governed evidence artifact.',
      },
      {
        title: 'I see unexpected results',
        description:
          'Repeat the case with the same inputs and compare across blotter/reporting to isolate data vs interpretation issues.',
      },
    ],
    supportChecklist: [
      'Mention the exact module where you are working.',
      'Share the deal ID or equivalent reference when available.',
      'Clarify whether the issue is about data, workflow or pricing interpretation.',
      'State what you expected versus what you are actually seeing.',
    ],
  },
  pt: {} as UserManualContent,
  fr: {} as UserManualContent,
  de: {} as UserManualContent,
};

CONTENT.pt = CONTENT.en;
CONTENT.fr = CONTENT.en;
CONTENT.de = CONTENT.en;

export function getUserManualContent(language: Language): UserManualContent {
  return CONTENT[language] ?? CONTENT.en;
}
