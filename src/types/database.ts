export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Row, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type AppRole = "admin" | "staff" | "client";

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string;
  role: AppRole;
  client_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadRow = {
  id: string;
  name: string;
  business_name: string;
  email: string;
  phone: string | null;
  industry: string | null;
  request: string;
  project_details: string;
  status: string;
  source: string;
  notes: Json;
  activity: Json;
  client_id: string | null;
  converted_at: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientRow = {
  id: string;
  contact_name: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  industry: string | null;
  website: string;
  location: string;
  status: string;
  source: string;
  source_lead_id: string | null;
  created_by: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
};

export type ClientStaffDataRow = {
  client_id: string;
  notes: Json;
  activity: Json;
  invoices: Json;
  messages: Json;
};

export type ProjectRow = {
  id: string;
  client_id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  archived: boolean;
  approval_status: string;
  created_by: string | null;
  last_activity_at: string;
  production_plan_generated_at: string | null;
  staging_url: string | null;
  production_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectDevelopmentRow = {
  project_id: string;
  repository_url: string | null;
  repository_branch: string | null;
  hosting_provider: string | null;
  deployment_status: string;
  last_deployed_at: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type MilestoneRow = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  status: string;
  position: number;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  project_id: string;
  milestone_id: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  assigned_to: string | null;
  position: number;
  due_date: string | null;
  completed_at: string | null;
  recommended_role: string | null;
  task_type: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskClientRequestRow = {
  id: string;
  task_id: string;
  project_id: string;
  client_id: string;
  status: string;
  message: string;
  client_response: string;
  requested_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  updated_at: string;
  created_by: string | null;
};

export type TaskClientRequestFileRow = {
  id: string;
  request_id: string;
  task_id: string;
  project_id: string;
  client_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  uploaded_by: string | null;
};

export type DeliverableRow = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FileVersionRow = {
  id: string;
  deliverable_id: string;
  version_number: number;
  label: string | null;
  description: string;
  is_current: boolean;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  storage_path: string | null;
  mime_type: string;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type FeedbackRow = {
  id: string;
  project_id: string;
  deliverable_id: string;
  version_id: string;
  client_id: string;
  message: string;
  status: string;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  resolved_at: string | null;
};

export type ApprovalRow = {
  id: string;
  project_id: string;
  deliverable_id: string;
  version_id: string;
  client_id: string;
  status: "Approved";
  approved_by: string | null;
  approved_by_name: string;
  approved_at: string;
  created_at: string;
};

export type ActivityRow = {
  id: string;
  project_id: string;
  actor_id: string | null;
  activity_type: string;
  message: string;
  metadata: Json;
  created_at: string;
};

export type ConversationStatus = "open" | "closed";

export type ConversationRow = {
  id: string;
  client_id: string;
  project_id: string | null;
  subject: string;
  status: ConversationStatus;
  created_by: string | null;
  last_message_preview: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

export type MessageSenderRole = "admin" | "client";

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  sender_role: MessageSenderRole;
  sender_label: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type NotificationType =
  | "new_message"
  | "feedback_received"
  | "changes_requested"
  | "version_ready_for_review"
  | "version_approved"
  | "project_update"
  | "proposal_ready"
  | "proposal_viewed"
  | "proposal_accepted"
  | "proposal_declined"
  | "contract_ready"
  | "contract_viewed"
  | "contract_accepted"
  | "contract_declined"
  | "invoice_ready"
  | "invoice_viewed"
  | "payment_recorded"
  | "payment_received"
  | "invoice_paid"
  | "invoice_overdue"
  | "task_assigned"
  | "task_status_changed"
  | "project_assigned"
  | "milestone_updated";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  conversation_id: string | null;
  message_id: string | null;
  project_id: string | null;
  deliverable_id: string | null;
  proposal_id: string | null;
  contract_id: string | null;
  invoice_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export type ClientInvitationRow = {
  id: string;
  client_id: string;
  email: string;
  invitee_name: string;
  token_hash: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  created_by: string | null;
  revoked_at: string | null;
};

export type InvitationPreviewRow = {
  state: string;
  company_name: string | null;
};

export type DocumentStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired" | "cancelled";

export type ProposalRow = {
  id: string;
  client_id: string;
  project_id: string | null;
  proposal_number: string;
  working_revision_id: string | null;
  published_revision_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProposalRevisionRow = {
  id: string;
  proposal_id: string;
  revision_number: number;
  status: DocumentStatus;
  title: string;
  introduction: string;
  overview: string;
  scope: string;
  deliverables_text: string;
  timeline: string;
  payment_terms: string;
  terms: string;
  notes: string;
  investment_cents: number;
  valid_until: string | null;
  snapshot_items: Json | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  accepted_email: string | null;
  declined_at: string | null;
  declined_by_user_id: string | null;
  decline_reason: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProposalItemRow = {
  id: string;
  revision_id: string;
  name: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  sort_order: number;
};

export type ProposalAdminNoteRow = {
  revision_id: string;
  notes: string;
};

export type ContractRow = {
  id: string;
  client_id: string;
  project_id: string | null;
  proposal_id: string | null;
  contract_number: string;
  working_revision_id: string | null;
  published_revision_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client_signed_copy_path: string | null;
  client_signed_copy_file_name: string;
  client_signed_copy_mime_type: string;
  client_signed_copy_size: number;
  client_signed_copy_uploaded_at: string | null;
  client_signed_copy_uploaded_by: string | null;
};

export type ContractRevisionRow = {
  id: string;
  contract_id: string;
  revision_number: number;
  status: DocumentStatus;
  title: string;
  parties: string;
  scope: string;
  responsibilities: string;
  timeline: string;
  compensation: string;
  payment_terms: string;
  confidentiality: string;
  intellectual_property: string;
  revisions_policy: string;
  termination: string;
  general_terms: string;
  effective_date: string | null;
  expires_at: string | null;
  snapshot: Json | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  accepted_email: string | null;
  declined_at: string | null;
  declined_by_user_id: string | null;
  decline_reason: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  agency_signed_at: string | null;
  agency_signed_by: string | null;
  agency_signed_name: string;
  agency_signed_email: string;
};

export type ContractAdminNoteRow = {
  revision_id: string;
  notes: string;
};

export type InvoiceStatus = "draft" | "sent" | "viewed" | "partially_paid" | "paid" | "cancelled";

export type PaymentMethod = "bank_transfer" | "cash" | "check" | "other" | "stripe";
export type PaymentProvider = "manual" | "stripe";

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  client_id: string;
  project_id: string | null;
  contract_id: string | null;
  proposal_id: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  amount_due_cents: number;
  notes: string;
  snapshot_items: Json | null;
  bill_to: Json | null;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  overdue_notified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  sort_order: number;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  invoice_id: string;
  amount_cents: number;
  currency: string;
  payment_date: string;
  payment_method: PaymentMethod;
  provider: PaymentProvider;
  reference: string;
  notes: string;
  recorded_by: string | null;
  recorded_by_label: string;
  reversed_at: string | null;
  reversed_by: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_event_id: string | null;
  created_at: string;
};

export type InvoiceAdminNoteRow = {
  invoice_id: string;
  notes: string;
};

export type StaffInvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export type StaffProfileRow = {
  user_id: string;
  job_title: string;
  template_key: string;
  is_active: boolean;
  deactivated_at: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type StaffGrantRow = {
  user_id: string;
  permission_code: string;
  granted_by: string | null;
  created_at: string;
};

export type StaffInvitationRow = {
  id: string;
  email: string;
  invitee_name: string;
  job_title: string;
  template_key: string;
  permission_codes: string[];
  token_hash: string;
  status: StaffInvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  accepted_user_id: string | null;
  created_at: string;
  created_by: string | null;
  revoked_at: string | null;
};

export type ClientStaffAssignmentRow = {
  id: string;
  client_id: string;
  user_id: string;
  label: string;
  assigned_by: string | null;
  created_at: string;
};

export type ProjectStaffAssignmentRow = {
  id: string;
  project_id: string;
  user_id: string;
  label: string;
  assigned_by: string | null;
  created_at: string;
};

export type StaffTemplateRow = {
  key: string;
  label: string;
  profile_role: "admin" | "staff";
};

export type StaffPermissionCatalogRow = {
  code: string;
  label: string;
  sort_order: number;
};

export type StaffTemplatePermissionRow = {
  template_key: string;
  permission_code: string;
};

export type StaffInvitationPreviewRow = {
  state: string;
  role_label: string | null;
};

export type ClientScopeBriefRow = {
  id: string;
  client_id: string;
  selected_pages: string[];
  goal: string;
  features: string[];
  other_pages: string;
  other_features: string;
  has_existing_website: boolean | null;
  current_website_url: string;
  current_website_notes: string;
  design_styles: string[];
  other_style: string;
  liked_websites: string;
  additional_notes: string;
  submitted_at: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type DiscoveryIntakeRow = {
  id: string;
  project_id: string;
  client_id: string;
  status: string;
  form_data: Json;
  section_review: Json;
  scope_flags: Json;
  follow_up: Json;
  internal_notes: string;
  sent_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type DiscoveryIntakeFileRow = {
  id: string;
  intake_id: string;
  project_id: string;
  client_id: string;
  category: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  uploaded_by: string | null;
};

export type AgencySettingsRow = {
  id: number;
  agency_name: string;
  business_email: string;
  phone: string;
  website: string;
  address: string;
  timezone: string;
  currency: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  support_email: string;
  email_from_name: string;
  email_from_address: string;
  email_reply_to: string;
  default_proposal_valid_days: number;
  default_proposal_introduction: string;
  default_proposal_overview: string;
  default_proposal_scope: string;
  default_proposal_deliverables: string;
  default_proposal_timeline: string;
  default_proposal_payment_terms: string;
  default_proposal_terms: string;
  default_proposal_notes: string;
  default_contract_terms: string;
  default_invoice_due_days: number;
  default_invoice_payment_terms: string;
  default_invoice_notes: string;
  client_portal_welcome_message: string;
  default_proposal_website_cents?: number | null;
  default_addon_quote_request_form_cents?: number | null;
  default_addon_booking_form_cents?: number | null;
  default_addon_social_media_cents?: number | null;
  default_addon_business_email_cents?: number | null;
  default_addon_domain_cents?: number | null;
  default_addon_hosting_setup_cents?: number | null;
  updated_at: string;
  updated_by: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Partial<ProfileRow> & { id: string }>;
      leads: Table<LeadRow, Partial<LeadRow> & { name: string; business_name: string; email: string }>;
      clients: Table<ClientRow, Partial<ClientRow> & { contact_name: string; business_name: string }>;
      client_staff_data: Table<ClientStaffDataRow, Partial<ClientStaffDataRow> & { client_id: string }>;
      projects: Table<ProjectRow, Partial<ProjectRow> & { client_id: string; name: string }>;
      project_development: Table<
        ProjectDevelopmentRow,
        Partial<ProjectDevelopmentRow> & { project_id: string },
        Partial<ProjectDevelopmentRow>
      >;
      milestones: Table<MilestoneRow, Partial<MilestoneRow> & { project_id: string; name: string }>;
      tasks: Table<TaskRow, Partial<TaskRow> & { project_id: string; title: string }>;
      deliverables: Table<DeliverableRow, Partial<DeliverableRow> & { project_id: string; name: string }>;
      file_versions: Table<FileVersionRow, Partial<FileVersionRow> & { deliverable_id: string; version_number: number }>;
      feedback: Table<
        FeedbackRow,
        Partial<FeedbackRow> & {
          project_id: string;
          deliverable_id: string;
          version_id: string;
          client_id: string;
          message: string;
        }
      >;
      approvals: Table<
        ApprovalRow,
        Partial<ApprovalRow> & {
          project_id: string;
          deliverable_id: string;
          version_id: string;
          client_id: string;
        }
      >;
      activity: Table<ActivityRow, Partial<ActivityRow> & { project_id: string; activity_type: string; message: string }>;
      conversations: Table<
        ConversationRow,
        Partial<ConversationRow> & { client_id: string; subject: string }
      >;
      messages: Table<MessageRow, Partial<MessageRow> & { conversation_id: string; body: string }>;
      notifications: Table<NotificationRow, Partial<NotificationRow> & { user_id: string; type: NotificationType; title: string }>;
      client_invitations: Table<
        ClientInvitationRow,
        Partial<ClientInvitationRow> & { client_id: string; email: string; token_hash: string; expires_at: string }
      >;
      proposals: Table<ProposalRow, Partial<ProposalRow> & { client_id: string; proposal_number: string }>;
      proposal_revisions: Table<
        ProposalRevisionRow,
        Partial<ProposalRevisionRow> & { proposal_id: string; revision_number: number }
      >;
      proposal_items: Table<
        ProposalItemRow,
        Partial<ProposalItemRow> & { revision_id: string; name: string }
      >;
      proposal_admin_notes: Table<ProposalAdminNoteRow, Partial<ProposalAdminNoteRow> & { revision_id: string }>;
      contracts: Table<ContractRow, Partial<ContractRow> & { client_id: string; contract_number: string }>;
      contract_revisions: Table<
        ContractRevisionRow,
        Partial<ContractRevisionRow> & { contract_id: string; revision_number: number }
      >;
      contract_admin_notes: Table<ContractAdminNoteRow, Partial<ContractAdminNoteRow> & { revision_id: string }>;
      invoices: Table<InvoiceRow, Partial<InvoiceRow> & { client_id: string; invoice_number: string }>;
      invoice_items: Table<InvoiceItemRow, Partial<InvoiceItemRow> & { invoice_id: string; description: string }>;
      payments: Table<PaymentRow, Partial<PaymentRow> & { invoice_id: string; amount_cents: number; payment_method: PaymentMethod }>;
      invoice_admin_notes: Table<InvoiceAdminNoteRow, Partial<InvoiceAdminNoteRow> & { invoice_id: string }>;
      stripe_checkout_sessions: Table<
        {
          id: string;
          invoice_id: string;
          client_id: string;
          created_by: string | null;
          stripe_checkout_session_id: string;
          stripe_payment_intent_id: string | null;
          amount_cents: number;
          currency: string;
          status: string;
          created_at: string;
          completed_at: string | null;
        },
        {
          invoice_id: string;
          client_id: string;
          stripe_checkout_session_id: string;
          amount_cents: number;
          currency: string;
        }
      >;
      client_stripe_customers: Table<
        { client_id: string; stripe_customer_id: string; created_at: string; updated_at: string },
        { client_id: string; stripe_customer_id: string }
      >;
      stripe_processed_events: Table<
        {
          event_id: string;
          event_type: string;
          invoice_id: string | null;
          payment_id: string | null;
          created_at: string;
        },
        { event_id: string; event_type: string }
      >;
      staff_profiles: Table<StaffProfileRow>;
      staff_grants: Table<StaffGrantRow>;
      staff_invitations: Table<StaffInvitationRow>;
      client_staff_assignments: Table<ClientStaffAssignmentRow>;
      project_staff_assignments: Table<ProjectStaffAssignmentRow>;
      staff_templates: Table<StaffTemplateRow>;
      staff_permission_catalog: Table<StaffPermissionCatalogRow>;
      staff_template_permissions: Table<StaffTemplatePermissionRow>;
      agency_settings: Table<AgencySettingsRow>;
      client_scope_briefs: Table<
        ClientScopeBriefRow,
        Partial<ClientScopeBriefRow> & { client_id: string; selected_pages: string[]; goal: string }
      >;
      discovery_intakes: Table<
        DiscoveryIntakeRow,
        Partial<DiscoveryIntakeRow> & { project_id: string; client_id: string },
        Partial<DiscoveryIntakeRow>
      >;
      discovery_intake_files: Table<
        DiscoveryIntakeFileRow,
        Partial<DiscoveryIntakeFileRow> & {
          intake_id: string;
          project_id: string;
          client_id: string;
          file_name: string;
          storage_path: string;
        }
      >;
      task_client_requests: Table<
        TaskClientRequestRow,
        Partial<TaskClientRequestRow> & { task_id: string; project_id: string; client_id: string },
        Partial<TaskClientRequestRow>
      >;
      task_client_request_files: Table<
        TaskClientRequestFileRow,
        Partial<TaskClientRequestFileRow> & {
          request_id: string;
          task_id: string;
          project_id: string;
          client_id: string;
          file_name: string;
          storage_path: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      create_file_version: {
        Args: {
          p_deliverable_id: string;
          p_file_name: string;
          p_file_type: string;
          p_file_size: number;
          p_description: string;
          p_uploaded_by?: string;
          p_version_id?: string;
          p_storage_path?: string | null;
          p_mime_type?: string;
        };
        Returns: FileVersionRow;
      };
      set_current_file_version: {
        Args: { p_deliverable_id: string; p_version_id: string };
        Returns: FileVersionRow;
      };
      client_submit_feedback: {
        Args: { p_deliverable_id: string; p_message: string; p_request_changes?: boolean };
        Returns: FeedbackRow;
      };
      client_approve_current_version: {
        Args: { p_deliverable_id: string };
        Returns: ApprovalRow;
      };
      admin_link_client_account: {
        Args: { p_client_id: string; p_email: string };
        Returns: ProfileRow;
      };
      start_conversation: {
        Args: { p_subject: string; p_body: string; p_project_id?: string | null; p_client_id?: string | null };
        Returns: ConversationRow;
      };
      send_message: {
        Args: { p_conversation_id: string; p_body: string };
        Returns: MessageRow;
      };
      mark_conversation_read: {
        Args: { p_conversation_id: string };
        Returns: number;
      };
      set_conversation_status: {
        Args: { p_conversation_id: string; p_status: string };
        Returns: ConversationRow;
      };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: null;
      };
      mark_all_notifications_read: {
        Args: Record<string, never>;
        Returns: number;
      };
      clear_notifications: {
        Args: Record<string, never>;
        Returns: number;
      };
      owns_conversation: {
        Args: { p_conversation_id: string };
        Returns: boolean;
      };
      preview_client_invitation: {
        Args: { p_token: string };
        Returns: InvitationPreviewRow[];
      };
      invitation_email_matches: {
        Args: { p_token: string; p_email: string };
        Returns: boolean;
      };
      accept_client_invitation: {
        Args: { p_token: string };
        Returns: null;
      };
      create_proposal: {
        Args: { p_client_id: string; p_project_id?: string | null; p_title?: string };
        Returns: string;
      };
      create_proposal_revision: {
        Args: { p_proposal_id: string };
        Returns: string;
      };
      discard_proposal_draft: {
        Args: { p_proposal_id: string };
        Returns: null;
      };
      send_proposal: {
        Args: { p_proposal_id: string };
        Returns: null;
      };
      mark_proposal_viewed: {
        Args: { p_proposal_id: string };
        Returns: null;
      };
      accept_proposal: {
        Args: { p_proposal_id: string };
        Returns: null;
      };
      decline_proposal: {
        Args: { p_proposal_id: string; p_reason?: string };
        Returns: null;
      };
      cancel_proposal: {
        Args: { p_proposal_id: string };
        Returns: null;
      };
      restore_proposal: {
        Args: { p_proposal_id: string };
        Returns: null;
      };
      delete_proposal: {
        Args: { p_proposal_id: string };
        Returns: null;
      };
      create_contract: {
        Args: {
          p_client_id: string;
          p_project_id?: string | null;
          p_proposal_id?: string | null;
          p_title?: string;
        };
        Returns: string;
      };
      create_contract_revision: {
        Args: { p_contract_id: string };
        Returns: string;
      };
      send_contract: {
        Args: { p_contract_id: string };
        Returns: null;
      };
      sign_contract: {
        Args: { p_contract_id: string };
        Returns: null;
      };
      register_contract_signed_copy: {
        Args: {
          p_contract_id: string;
          p_storage_path: string;
          p_file_name: string;
          p_mime_type: string;
          p_file_size: number;
        };
        Returns: string | null;
      };
      mark_contract_viewed: {
        Args: { p_contract_id: string };
        Returns: null;
      };
      accept_contract: {
        Args: { p_contract_id: string };
        Returns: null;
      };
      decline_contract: {
        Args: { p_contract_id: string; p_reason?: string };
        Returns: null;
      };
      cancel_contract: {
        Args: { p_contract_id: string };
        Returns: null;
      };
      restore_contract: {
        Args: { p_contract_id: string };
        Returns: null;
      };
      delete_contract: {
        Args: { p_contract_id: string };
        Returns: null;
      };
      create_invoice: {
        Args: {
          p_client_id: string;
          p_project_id?: string | null;
          p_contract_id?: string | null;
          p_proposal_id?: string | null;
        };
        Returns: string;
      };
      update_invoice_draft: {
        Args: {
          p_invoice_id: string;
          p_issue_date: string;
          p_due_date: string;
          p_currency: string;
          p_tax_cents: number;
          p_discount_cents: number;
          p_notes: string;
          p_project_id?: string | null;
          p_contract_id?: string | null;
          p_proposal_id?: string | null;
          p_admin_notes?: string;
          p_items?: Json;
        };
        Returns: null;
      };
      send_invoice: {
        Args: { p_invoice_id: string };
        Returns: null;
      };
      cancel_invoice: {
        Args: { p_invoice_id: string };
        Returns: null;
      };
      restore_invoice: {
        Args: { p_invoice_id: string };
        Returns: null;
      };
      reopen_invoice_draft: {
        Args: { p_invoice_id: string };
        Returns: null;
      };
      delete_invoice: {
        Args: { p_invoice_id: string };
        Returns: null;
      };
      mark_invoice_viewed: {
        Args: { p_invoice_id: string };
        Returns: null;
      };
      record_invoice_payment: {
        Args: {
          p_invoice_id: string;
          p_amount_cents: number;
          p_payment_date?: string;
          p_method?: string;
          p_reference?: string;
          p_notes?: string;
        };
        Returns: string;
      };
      prepare_project_production_from_paid_invoice: {
        Args: { p_invoice_id: string };
        Returns: number;
      };
      reverse_invoice_payment: {
        Args: { p_payment_id: string };
        Returns: null;
      };
      record_stripe_payment: {
        Args: {
          p_invoice_id: string;
          p_amount_cents: number;
          p_currency: string;
          p_checkout_session_id: string;
          p_payment_intent_id: string;
          p_event_id?: string | null;
        };
        Returns: Json;
      };
      current_staff_context: {
        Args: Record<string, never>;
        Returns: Json;
      };
      delete_project: {
        Args: { p_project_id: string };
        Returns: null;
      };
      preview_staff_invitation: {
        Args: { p_token: string };
        Returns: StaffInvitationPreviewRow[];
      };
      staff_invitation_email_matches: {
        Args: { p_token: string; p_email: string };
        Returns: boolean;
      };
      accept_staff_invitation: {
        Args: { p_token: string };
        Returns: null;
      };
      touch_staff_last_active: {
        Args: Record<string, never>;
        Returns: null;
      };
      assign_staff_to_client: {
        Args: { p_client_id: string; p_user_id: string; p_label?: string };
        Returns: null;
      };
      unassign_staff_from_client: {
        Args: { p_client_id: string; p_user_id: string };
        Returns: null;
      };
      assign_staff_to_project: {
        Args: { p_project_id: string; p_user_id: string; p_label?: string };
        Returns: null;
      };
      unassign_staff_from_project: {
        Args: { p_project_id: string; p_user_id: string };
        Returns: null;
      };
      update_staff_member: {
        Args: {
          p_user_id: string;
          p_full_name?: string | null;
          p_job_title?: string | null;
          p_template_key?: string | null;
          p_permission_codes?: string[] | null;
          p_is_active?: boolean | null;
        };
        Returns: null;
      };
      staff_can_access_client: {
        Args: { p_client_id: string; p_perm: string };
        Returns: boolean;
      };
      get_agency_settings: {
        Args: Record<string, never>;
        Returns: AgencySettingsRow;
      };
      update_agency_settings: {
        Args: { p_patch: Json };
        Returns: AgencySettingsRow;
      };
      get_client_portal_welcome: {
        Args: Record<string, never>;
        Returns: string;
      };
      update_own_profile: {
        Args: { p_full_name?: string | null; p_job_title?: string | null };
        Returns: null;
      };
      purge_workspace: {
        Args: { p_scope: string; p_confirmation: string };
        Returns: Json;
      };
      update_my_task_status: {
        Args: { p_task_id: string; p_status: string };
        Returns: null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
