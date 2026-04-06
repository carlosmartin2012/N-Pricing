import { approvalService } from './supabase/approvalService';
import { auditService } from './supabase/audit';
import { configService } from './supabase/config';
import { dealService } from './supabase/deals';
import { marketDataIngestionService } from './supabase/marketDataIngestionService';
import { marketDataService } from './supabase/market';
import { masterDataService } from './supabase/masterData';
import { methodologyService } from './supabase/methodologyService';
import { monitoringService } from './supabase/monitoring';
import { portfolioReportingService } from './supabase/portfolioReportingService';
import { ruleService } from './supabase/rules';

export const supabaseService = {
  ...approvalService,
  ...auditService,
  ...dealService,
  ...ruleService,
  ...masterDataService,
  ...monitoringService,
  ...methodologyService,
  ...portfolioReportingService,
  ...marketDataService,
  ...marketDataIngestionService,
  ...configService,
};
