"""Rule-based intent detection for the Operator AI Chatbot.

Rules are checked IN ORDER — most specific rules FIRST.
Supports English and Telugu-English mixed operator questions.
"""

from __future__ import annotations
import re


INTENT_RULES: list[tuple[str, str, dict]] = [

    # ════════════════════════════════════════════════════════════════════════
    # 0. CLOCK IN / OUT  (exact short phrases — highest priority)
    # ════════════════════════════════════════════════════════════════════════
    (r"clock\s*in\b|clockin|punch\s*in|check\s*in\b|clocking\s*in", "clock_in", {}),
    (r"clock\s*out\b|clockout|punch\s*out|check\s*out\b|clocking\s*out", "clock_out", {}),
    (r"ela.*clock\s*in|clock\s*in.*(?:ela|cheyali|cheyandi)", "clock_in", {}),

    # Work-order actions must be checked before generic WO lookups.
    (r"start\s+(WO-[\w]+|[\w]+-[\w]+)|start\s+production\s+(?:of\s+)?(WO-[\w]+)", "work_order_action", {"action": "start"}),
    (r"pause\s+(WO-[\w]+|[\w]+-[\w]+)|pause\s+work\s*order", "work_order_action", {"action": "pause"}),
    (r"resume\s+(WO-[\w]+|[\w]+-[\w]+)|resume\s+work\s*order", "work_order_action", {"action": "resume"}),
    (r"complete\s+(?:the\s+)?(?:work\s*order\s+)?(WO-[\w]+|[\w]+-[\w]+)|mark\s+.*\bcomplete\b", "work_order_action", {"action": "complete"}),

    # ════════════════════════════════════════════════════════════════════════
    # 1. MACHINE BREAKDOWN REPORT
    # ════════════════════════════════════════════════════════════════════════
    (r"report\s+breakdown|machine\s+(?:broken|failure|fault|error)\b|breakdown\s+report|machine\s+down\b", "report_machine_breakdown", {}),
    (r"break\s*down\s+machine|machine\s+break\s*down|machine\s+not\s+working|machine\s+stopped", "get_machine_deep_status", {}),
    (r"which\s+machine\s+(?:is\s+)?(?:broken|down|failed|fault)|machines?\s+(?:in\s+)?breakdown", "get_machine_deep_status", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 2. TODAY'S WORK ORDERS  (very specific — before generic WO rules)
    # ════════════════════════════════════════════════════════════════════════
    (r"today(?:'?s?)?\s+(?:work\s*orders?|job\s*cards?|jobs?)|(?:work\s*orders?|job\s*cards?)\s+(?:for\s+)?today", "get_todays_work_orders", {}),
    (r"\bmy\s+(?:work\s*orders?|jobs?|job\s*cards?)\b|show\s+(?:my\s+)?(?:work\s*orders?|jobs?)|list\s+(?:work\s*orders?|jobs?)", "get_todays_work_orders", {}),
    (r"(?:naa|na|mana)\s+work\s*orders?|work\s*orders?\s*(?:enti|cheppu|cheppandi|ela)", "get_todays_work_orders", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 3. TODAY'S PRODUCTION  (specific — before generic "production" rules)
    # ════════════════════════════════════════════════════════════════════════
    (r"today(?:'?s?)?\s+production(?!\s+(?:schedule|plan|overview|order|summar|stats|target|status))|production\s+(?:for\s+)?today(?!\s+(?:schedule|plan|overview))", "get_todays_production", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 4. PENDING / ASSIGNED WORK ORDERS  (specific — before generic)
    # ════════════════════════════════════════════════════════════════════════
    (r"pending\s+work\s*orders?|open\s+work\s*orders?|not\s+started\s+work\s*orders?", "get_pending_work_orders", {}),
    (r"(?:planned|scheduled|in\s*progress|completed|finished|paused|cancelled)\s+work\s*orders?", "get_work_order_stats_deep", {}),
    (r"planned\s+(?:production\s+)?orders?|scheduled\s+orders?", "get_production_overview_deep", {}),
    (r"assigned\s+(?:work\s*orders?|jobs?)|my\s+assigned\s+(?:work\s*orders?|jobs?)", "get_assigned_work_orders", {}),
    (r"(?:open|show|find|get|detail\s+of)\s+(?:work\s*order\s+)?(WO-[\w]+)|WO-(\d+)", "get_work_order_by_number", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 5. MRP DEEP  (before "material" general)
    # ════════════════════════════════════════════════════════════════════════
    (r"\bmrp\b|material\s+requirement|material\s+planning|bom\s+material|bill\s+of\s+material", "get_mrp_deep", {}),
    (r"material\s+shortage\s+in\s+schedule|shortage\s+in\s+schedule|schedule\s+shortage|schedule.*material.*shortage", "get_production_schedule_stats_deep", {}),
    (r"material\s+(?:shortage|short|miss|lack|need|check|status|availab)|shortage.*material|which.*material.*(?:short|miss|need|lack)", "get_mrp_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 5A. PRODUCT DETAIL (time, BOM, raw materials, machine, manpower)
    # ════════════════════════════════════════════════════════════════════════
    (r"(?:raw\s+materials?|bom|production\s+time|how\s+much\s+material|manpower|which\s+machine|machine\s+used|full\s+details?|complete\s+details?).*(?:for|of|about)\s+(.+)$", "get_product_detail_deep", {}),
    (r"how\s+long\s+(?:does|will)\s+(.+?)\s+(?:take|to\s+(?:make|complete|produce))$", "get_product_detail_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 6. PRODUCT OVERVIEW DEEP
    # ════════════════════════════════════════════════════════════════════════
    (r"total\s+products?|how\s+many\s+products?|all\s+products?|product\s+(?:overview|summar|status|list)|product\s+wise", "get_product_overview_deep", {}),
    (r"\bproducts?\s+(?:planned|in.progress|completed|delayed|cancelled)\b", "get_product_overview_deep", {}),
    (r"\btoday(?:'?s?)?\s+products?\b|\bproducts?\s+today\b", "get_product_overview_deep", {}),
    (r"\b(?:completed|delayed|planned|cancelled)\s+products?\b", "get_product_overview_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 7. PRODUCTION OVERVIEW DEEP  (order counts — before generic schedule/plan)
    # ════════════════════════════════════════════════════════════════════════
    (r"\b(?:pending|open|not\s+started)\s+orders?\b", "get_production_overview_deep", {}),
    (r"\b(?:completed?|done|finished|closed)\s+orders?\b", "get_production_overview_deep", {}),
    (r"\b(?:delayed?|overdue|behind)\s+orders?\b", "get_production_overview_deep", {}),
    (r"\bcancelled?\s+orders?\b|\bin.progress\s+orders?\b", "get_production_overview_deep", {}),
    (r"today(?:'?s?)?\s+orders?|orders?\s+(?:for\s+)?today|today.*orders?", "get_production_overview_deep", {}),
    (r"total\s+orders?|how\s+many\s+orders?\b|all\s+orders?|orders?\s+(?:summar|overview)", "get_production_overview_deep", {}),
    (r"production\s+overview|overall\s+production|production\s+summar|production\s+status\s+overview", "get_production_overview_deep", {}),
    (r"how\s+many\s+(?:job|batch|operator)s?\s+(?:running|active|pending|done|completed)", "get_production_overview_deep", {}),
    (r"production\s*(?:ela|undi|cheppu|status\s*enti)|ela.*production\s+(?:undi|enta|ela)", "get_production_overview_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 7A. GENERAL OPERATOR MODULE QUESTIONS
    # ════════════════════════════════════════════════════════════════════════
    (r"operator\s+module|factory\s+(?:status|overview|report)|plant\s+(?:status|overview|report)|manufacturing\s+(?:status|overview|report)|overall\s+(?:operator|factory|plant|shop\s*floor)\s+(?:status|overview|report)|what(?:'s|\s+is)\s+happening", "get_shopfloor_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 8. WORK ORDER STATS DEEP  (total WOs, high-priority, all WOs stats)
    # ════════════════════════════════════════════════════════════════════════
    (
        r"total\s+work\s*orders?|work\s*orders?\s*(?:enni|enti|count|total)|"
        r"work\s*order\s+(?:count|total)(?!\s+(?:stats|statistics|summar))",
        "get_assigned_work_orders",
        {},
    ),
    (
        r"work\s*order\s+(?:stats|statistics|summar|overview)|all\s+work\s*orders?\s+(?:stats|statistics|summar)",
        "get_work_order_stats_deep",
        {},
    ),
    (r"(?:planned|in.progress|completed|high.priority|paused|cancelled)\s+work\s*orders?\s*(?:count|total|how\s+many)?", "get_work_order_stats_deep", {}),
    (r"high\s+priority\s+work\s*orders?|how\s+many\s+work\s*orders?", "get_work_order_stats_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 9. PRODUCTION SCHEDULE STATS DEEP  (utilization, operator presence, target)
    # ════════════════════════════════════════════════════════════════════════
    (r"machine\s+utilization\s+(?:rate|pct|percent|%)", "get_machine_allocation_deep", {}),
    (r"machine\s+utilization\b", "get_production_schedule_stats_deep", {}),
    (r"schedule\s+(?:stats|summar|overview|utiliz|operator|material|target)|production\s+schedule\s+(?:stats|summar|overview)", "get_production_schedule_stats_deep", {}),
    (r"(?:completed?|pending|in.progress|delayed)\s+schedules?", "get_production_schedule_stats_deep", {}),
    (r"operator\s+presence|operator\s+present\b|production\s+target\s+(?:today|vs|actual)", "get_production_schedule_stats_deep", {}),
    (r"material\s+shortage\s+in\s+schedule|shortage\s+in\s+schedule|schedule\s+shortage|schedule.*material.*shortage", "get_production_schedule_stats_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 10. MACHINE ALLOCATION DEEP
    # ════════════════════════════════════════════════════════════════════════
    (r"machine\s+allocation|allocation\s+(?:status|detail|overview|summar)|which\s+machine\s+(?:is\s+)?allocat", "get_machine_allocation_deep", {}),
    (r"free\s+machines?|available\s+machines?|machines?\s+(?:free|available|not\s+assign|unassign)", "get_machine_allocation_deep", {}),
    (r"machine\s+(?:assign|capacity|supervisor)\b|supervisor.*machine|capacity.*machine", "get_machine_allocation_deep", {}),
    (r"total\s+machines?\s+(?:allocated|free|maintenance|utiliz)|allocated\s+machines?", "get_machine_allocation_deep", {}),
    (r"under\s+maintenance\s+machines?|machines?\s+under\s+maintenance", "get_machine_allocation_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 11. BATCH SUMMARY DEEP  (total/running/completed/hold/rejected/expired)
    # ════════════════════════════════════════════════════════════════════════
    (r"total\s+batches?|how\s+many\s+batches?|batch\s+(?:summar|overview|count|total|all)|all\s+batches?", "get_batch_summary_deep", {}),
    (r"batch\s+tracking|track\s+batches?", "get_batch_summary_deep", {}),
    (r"\bbatches?\s+(?:running|completed|hold|rejected|expired)\b|running\s+batches?|completed\s+batches?|hold\s+batches?", "get_batch_summary_deep", {}),
    (r"rejected\s+batches?|batches?\s+rejected|expired\s+batches?|batches?\s+expired", "get_batch_summary_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 12. MACHINE STATUS DEEP  (total/running/idle/maintenance/breakdown/offline)
    # ════════════════════════════════════════════════════════════════════════
    (r"machine\s+status\s+(?:overview|summar|all|total|detail|report)|all\s+machine\s+status", "get_machine_status_deep", {}),
    (r"(?:total|all|how\s+many)\s+machines?\b|machines?\s+(?:total|overview|summary|list)\b", "get_machine_status_deep", {}),
    (r"(?:how\s+many|total)\s+machines?\s+(?:running|idle|maintenance|breakdown|offline)|machines?\s+(?:running|idle|maintenance|breakdown|offline)\s+(?:count|total)", "get_machine_deep_status", {}),
    (r"idle\s+machines?|machines?\s+idle\b|breakdown\s+machines?|machines?\s+breakdown\b|offline\s+machines?", "get_machine_deep_status", {}),
    (r"machines?\s+(?:in\s+)?maintenance\b|maintenance\s+machines?", "get_machine_deep_status", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 13. SCHEDULE DEEP  (before generic production schedule)
    # ════════════════════════════════════════════════════════════════════════
    (r"production\s+schedule\s+(?:today|this\s+week|detail|deep|full|all|overview)|today(?:'?s?)?\s+(?:production\s+)?schedule", "get_schedule_deep", {}),
    (r"schedule\s+(?:detail|deep|full|all|overview|status|week|today)", "get_schedule_deep", {}),
    (r"who\s+is\s+(?:on|at|assign|working|doing).*machine|machine\s+assign.*schedule|operator.*schedule|schedule.*operator", "get_schedule_deep", {}),
    (r"upcoming\s+(?:work\s*orders?|jobs?|tasks?)|what\s+(?:is\s+)?(?:plan|scheduled?)(?:\s+for)?\s+(?:today|tomorrow|this\s+week)", "get_schedule_deep", {}),
    (r"shift\s+(?:assignment|schedule|plan|who)|who\s+is\s+on\s+(?:which\s+)?shift", "get_schedule_deep", {}),
    (r"schedule\s*(?:ela|undi|cheppu|enti)|production\s+schedule\s*(?:cheppu|cheppandi)", "get_schedule_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 14. SHOP FLOOR DEEP  (running jobs, operators working, downtime, scrap)
    # ════════════════════════════════════════════════════════════════════════
    (r"shop\s*floor(?:\s+(?:live|summar|overview|status|report|snapshot))?|floor\s+(?:status|overview|live|snapshot|report)", "get_shopfloor_deep", {}),
    (r"daily\s+production\s+reports?|production\s+reports?", "get_todays_production", {}),
    (r"running\s+jobs?\s+(?:today|now|on\s+floor)|jobs?\s+running\s+(?:today|now)", "get_shopfloor_deep", {}),
    (r"operators?\s+working\s+(?:today|now|on\s+floor|currently)|how\s+many\s+operators?\s+(?:working|on\s+floor|present)", "get_shopfloor_deep", {}),
    (r"downtime\s+(?:today|report|floor|minutes?)|today.*downtime|floor.*downtime", "get_shopfloor_deep", {}),
    (r"scrap\s+quantity|scrap\s+(?:today|report|floor)|today.*scrap", "get_shopfloor_deep", {}),
    (r"active\s+machines?\s+(?:on\s+floor|today|now)|machines?\s+active\s+on\s+floor", "get_shopfloor_deep", {}),
    (r"live\s+(?:floor|shop|production)|floor\s+live|production\s+floor\s+status", "get_shopfloor_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 15. MACHINE DEEP  (before simple machine status)
    # ════════════════════════════════════════════════════════════════════════
    (r"\bmanpower\b|man\s*power\b|workforce\b|how\s+many\s+(?:workers?|operators?|people|persons?)\s+(?:on|at|working\s+on|assigned\s+to)\s+machine", "get_machine_deep_status", {}),
    (r"machine\s+(?:deep|detail|full|everything|oee|efficiency|health|performance|temperature|rpm)\b", "get_machine_deep_status", {}),
    (r"\boee\b|overall\s+equipment|machine\s+efficiency|efficiency\s+(?:report|machine|of\s+machine)", "get_machine_deep_status", {}),
    (r"machine\s+for\s+(?:product|which|what)|product.*(?:which|what)\s+machine|active\s+machines?\s+(?:for|making|producing)", "get_machine_deep_status", {}),
    (r"machine\s+health|health\s+(?:score|machine)|machine\s+(?:maintenance\s+schedule|next\s+maintenance|last\s+maintenance)", "get_machine_deep_status", {}),
    (r"machines?\s*(?:ela\b|cheppu|cheppandi|undi|unnai|detail)|machines?\s+status\s+(?:cheppu|cheppandi|ela)", "get_machine_deep_status", {}),
    (r"manpower\s*(?:ela|undi|cheppu|enti)|ela.*manpower", "get_machine_deep_status", {}),
    # Running machines → deep status (rich output)
    (r"running\s+machines?|currently\s+running|which\s+machines?\s+(?:are\s+)?running", "get_machine_deep_status", {}),
    (r"tell\s+me\s+about\s+machines?|machines?\s+(?:info|information|report|overview|now|current|live)", "get_machine_deep_status", {}),
    (r"what\s+(?:are|is)\s+(?:the\s+)?machines?\s+(?:doing|running|status|now)|machines?\s+right\s+now", "get_machine_deep_status", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 16. WORK ORDER DEEP  (time remaining, delays — before actions)
    # ════════════════════════════════════════════════════════════════════════
    (r"how\s+(?:long|much\s+time)\s+(?:will\s+it\s+take|to\s+(?:complet|finish|done)|(?:does|do)\s+it\s+take)", "get_work_order_deep", {}),
    (r"(?:how\s+many\s+)?days?\s+(?:left|remaining|to\s+(?:finish|complet|done)|until\s+(?:done|complet))", "get_work_order_deep", {}),
    (r"time\s+(?:remaining|left|to\s+complet)|(?:remaining|left)\s+time\s+(?:for|on|in)\s+work", "get_work_order_deep", {}),
    (r"work\s*order\s+(?:deep|detail|full|everything|progress|delay|high\s+priority|manpower|operator)\b", "get_work_order_deep", {}),
    (r"delayed\s+work\s*orders?|overdue\s+work\s*orders?|which\s+work\s*orders?\s+(?:are\s+)?delayed", "get_work_order_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 17. BATCH DEEP  (traceability, yield, QC — before generic batch)
    # ════════════════════════════════════════════════════════════════════════
    (r"batch\s+(?:yield|quality|trace|traceab|detail|deep|full|all|report|qc|inspect|dispatch)", "get_batch_deep", {}),
    (r"batch\s+(?:quality\s+control|qc\s+status)|qc.*batch|quality\s+check.*batch", "get_batch_deep", {}),
    (r"trace(?:ability)?\s+(?:of\s+)?batch|batch.*(?:raw\s+material|dispatch|customer\s+delivery)", "get_batch_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 18. PRODUCTION PLAN DEEP
    # ════════════════════════════════════════════════════════════════════════
    (r"production\s+order\s+(?:detail|status|progress|deep)|customer\s+order\s+(?:status|progress|detail|delivery)", "get_production_plan_deep", {}),
    (r"delivery\s+(?:timeline|date|status|when)|when\s+(?:will|is)\s+(?:it|delivery|order)\s+(?:deliver|ready|done)", "get_production_plan_deep", {}),
    (r"due\s+date\s+(?:of\s+)?order|order.*due\s+date", "get_production_plan_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 19. ASSIGNED TASKS DEEP
    # ════════════════════════════════════════════════════════════════════════
    (r"assigned?\s+tasks?|tasks?\s+(?:assign|status|detail|deep|all|list|overview|allocation)", "get_assigned_tasks_deep", {}),
    (r"who\s+is\s+assign|who\s+(?:is\s+doing|does)\s+what|operator\s+(?:tasks?|assign|workload)", "get_assigned_tasks_deep", {}),
    (r"\bmy\s+tasks?\b|show\s+(?:my\s+)?tasks?|list\s+(?:my\s+)?tasks?|task\s+allocation", "get_assigned_tasks_deep", {}),
    (r"tasks?\s*(?:ela|undi|cheppu|enti)|(?:naa\s+)?tasks?\s*(?:cheppu|cheppandi)", "get_assigned_tasks_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 20. ATTENDANCE DEEP
    # ════════════════════════════════════════════════════════════════════════
    (r"attendance\s+(?:report|summar|detail|history|record|deep|30|month|last\s+30)", "get_attendance_deep", {}),
    (r"my\s+attendance\s+(?:record|history|report|detail|this\s+month|last\s+month)", "get_attendance_deep", {}),
    (r"how\s+many\s+days?\s+(?:present|attend|work|come)|days?\s+(?:present|attend).*(?:month|week|this|last)", "get_attendance_deep", {}),
    (r"total\s+hours?\s+work(?:ed)?|hours?\s+work(?:ed)?\s+(?:this|last|month|week)", "get_attendance_deep", {}),
    (r"attendance\s*(?:ela|undi|cheppu|enti)|naa.*attendance", "get_attendance_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 21. STANDARD: MACHINE STATUS (generic — after all deep machine rules)
    # ════════════════════════════════════════════════════════════════════════
    (r"\bmachine\s+status\b(?!\s+(?:overview|summar|all|total|detail|report))|\bstatus\s+of\s+all\s+machines?\b|show\s+machines?|list\s+machines?|all\s+machines?\b", "get_machine_status", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 22. STANDARD: RUNNING MACHINES — now routes to deep for full detail
    # ════════════════════════════════════════════════════════════════════════
    # (running machines already handled above in section 15 → get_machine_deep_status)

    # ════════════════════════════════════════════════════════════════════════
    # 23. STANDARD: MY ATTENDANCE
    # ════════════════════════════════════════════════════════════════════════
    (r"\bmy\s+attendance\b|\battendance\b|\bpresent\b|\babsent\b|\bshift\s+crew\b", "get_attendance_deep", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 24. STANDARD: PRODUCTION SCHEDULE / PLAN
    # ════════════════════════════════════════════════════════════════════════
    (r"production\s+schedule\b|shift\s+schedule\b", "get_production_schedule", {}),
    (r"production\s+plan\b|show\s+plan\b|plan\s+(?:for\s+)?today|today(?:'?s?)?\s+plan", "get_production_plan", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 25. STANDARD: BATCH STATUS / DETAILS
    # ════════════════════════════════════════════════════════════════════════
    (r"batch\s+status\b|pending\s+batches?|running\s+batch\b|batch\s+list", "get_batch_status", {}),
    (r"batch\s+(BT-[\w]+|BATCH-[\w]+)", "get_batch_details", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 26. WORK ORDER ACTIONS  (start/pause/resume/complete specific WO)
    # ════════════════════════════════════════════════════════════════════════
    (r"start\s+(WO-[\w]+|[\w]+-[\w]+)|start\s+production\s+(?:of\s+)?(WO-[\w]+)", "work_order_action", {"action": "start"}),
    (r"pause\s+(WO-[\w]+|[\w]+-[\w]+)|pause\s+work\s*order", "work_order_action", {"action": "pause"}),
    (r"resume\s+(WO-[\w]+|[\w]+-[\w]+)|resume\s+work\s*order", "work_order_action", {"action": "resume"}),
    (r"complet\w*\s+(WO-[\w]+|[\w]+-[\w]+)|mark.*complet|complet.*work\s*order", "work_order_action", {"action": "complete"}),

    # ════════════════════════════════════════════════════════════════════════
    # 27. UPDATE PROGRESS
    # ════════════════════════════════════════════════════════════════════════
    (r"update\s+progress|production\s+progress\b|progress\s+update|log\s+production", "update_production_progress", {}),

    # ════════════════════════════════════════════════════════════════════════
    # 28. TELUGU — remaining
    # ════════════════════════════════════════════════════════════════════════
    (r"batch\s*(?:ela|undi|cheppu|enti)|batch.*traceability.*(?:cheppu|cheppandi)", "get_batch_deep", {}),
    (r"(?:naa\s+)?attendance\s*(?:cheppu|cheppandi|show)", "get_attendance_deep", {}),
]


def detect_intent(message: str) -> tuple[str, dict] | None:
    """Match user message to the best operator tool and return (tool_name, args)."""
    text = message.strip().lower()

    # Normalize common aliases
    text = re.sub(r"\bjob\s+cards?\b", "work orders", text)
    text = re.sub(r"\bjc-?\d+\b", "work order", text)
    text = re.sub(r"shop\s+fllor", "shop floor", text)

    for pattern, tool, extra in INTENT_RULES:
        m = re.search(pattern, text, re.IGNORECASE)
        if not m:
            continue

        args = dict(extra)

        if tool == "get_work_order_by_number":
            for g in range(1, (m.lastindex or 0) + 1):
                try:
                    val = m.group(g)
                    if val:
                        args["work_order_number"] = val.upper().replace(" ", "")
                        break
                except IndexError:
                    pass

        elif tool == "get_product_detail_deep":
            args["product_name"] = m.group(1).strip(" ?.") if m.lastindex else message.strip()

        elif tool in (
            "get_machine_deep_status", "get_work_order_deep", "get_batch_deep",
            "get_production_plan_deep", "get_schedule_deep", "get_mrp_deep",
            "get_assigned_tasks_deep", "get_shopfloor_deep",
            "get_production_overview_deep", "get_attendance_deep",
            "get_product_overview_deep", "get_work_order_stats_deep",
            "get_production_schedule_stats_deep", "get_machine_allocation_deep",
            "get_batch_summary_deep", "get_machine_status_deep",
        ):
            args["query"] = message.strip()

        elif tool == "get_batch_details":
            for g in range(1, (m.lastindex or 0) + 1):
                try:
                    val = m.group(g)
                    if val:
                        args["batch_number"] = val.upper()
                        break
                except IndexError:
                    pass

        elif tool == "work_order_action":
            for g in range(1, (m.lastindex or 0) + 1):
                try:
                    val = m.group(g)
                    if val:
                        args["work_order_number"] = val.upper().replace(" ", "")
                        break
                except IndexError:
                    pass

        return tool, args

    return None