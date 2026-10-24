import type { BotLocale } from "./types";

type MessageMap = Record<string, string>;

const de: MessageMap = {
  // General
  "welcome_back": "👋 Willkommen zurück, {name}!\n\nDein Account ist verknüpft.",
  "welcome_new": "👋 Willkommen bei GripShot!\n\nUm den Bot zu nutzen, verknüpfe deinen Account:\n\n🔗 {url}\n\nDer Link ist 15 Minuten gültig.",
  "not_linked": "🔗 Dein Telegram-Account ist noch nicht verknüpft.\nNutze /start um die Verknüpfung zu starten.",
  "unknown_command": "Unbekannter Befehl. Nutze /help für eine Übersicht.",
  "processing_error": "❌ Nachricht konnte nicht verarbeitet werden. Bitte versuche es erneut.",
  "workspace_not_found": "❌ Workspace nicht gefunden. Kontaktiere den Support.",
  "cancelled": "❌ Abgebrochen.",
  "flow_cancelled": "✅ Aktion abgebrochen. Was möchtest du als nächstes tun?",

  // Status
  "status_title": "📊 *Status*\n\nPlan: {plan}\nCredits: {remaining} von {limit} übrig\nVerbraucht: {used}\n\n📦 {products} Produkte · 👤 {models} Models · 🖼 {backgrounds} Hintergründe",

  // Help
  "help": "🤖 *GripShot Bot — Hilfe*\n\n" +
    "*Befehle:*\n" +
    "/start — Account verknüpfen\n" +
    "/status — Plan, Credits & Übersicht\n" +
    "/dashboard — Web-Dashboard öffnen\n" +
    "/settings — Einstellungen öffnen\n\n" +
    "*Workflows:*\n" +
    "/newworkflow — Neuen Workflow starten\n" +
    "/workflows — Workflows anzeigen\n\n" +
    "*Ressourcen:*\n" +
    "/products — Produkte anzeigen\n" +
    "/models — Models anzeigen\n" +
    "/backgrounds — Hintergründe anzeigen\n" +
    "/newproduct — Neues Produkt anlegen\n" +
    "/newmodel — Neues Model anlegen\n" +
    "/newbackground — Neuen Hintergrund anlegen\n\n" +
    "/trash — Papierkorb anzeigen\n" +
    "/cancel — Aktuelle Aktion abbrechen\n" +
    "/help — Diese Hilfe\n\n" +
    "✨ *Workflows per Chat*\n" +
    "Schreibe einfach, was du brauchst, z.B.:\n" +
    '\"Erstell mir 10 Pilates-Übungen mit Miniball\"\n\n' +
    "🎤 *Sprachnachrichten*\n" +
    "Sende eine Sprachnachricht — der Bot transkribiert sie.",

  // Voice
  "voice_transcribing": "🎧 Transkribiere Sprachnachricht …",
  "voice_transcription_failed": "❌ Transkription fehlgeschlagen. Bitte versuche es erneut.",
  "voice_no_file": "❌ Konnte die Audiodatei nicht lesen.",
  "voice_result": "🗣️ *Erkannter Text:*\n\n{text}",
  "voice_confirmed": "✅ Bestätigt — wird verarbeitet …",
  "voice_edit_prompt": "✏️ Bitte sende den korrigierten Text als nächste Nachricht.",
  "voice_confirm_btn": "✅ Ja, los",
  "voice_edit_btn": "✏️ Anpassen",
  "voice_cancel_btn": "❌ Abbrechen",

  // Deep links
  "dashboard_link": "📊 Öffne dein Dashboard:\n\n🔗 {url}",
  "settings_link": "⚙️ Einstellungen öffnen:\n\n🔗 {url}",
  "results_link": "📸 Ergebnisse ansehen:\n\n🔗 {url}",

  // Intent routing
  "intent_question": "💡 Für Fragen nutze /status oder /help. Oder öffne das Dashboard.",
  "intent_feedback": "📝 Feedback notiert! Nutze die Buttons unter den Bildern.",
  "intent_unclear": "Ich bin nicht sicher, was du möchtest. Beschreibe z.B. welche Bilder du erstellen willst, oder nutze /help.",

  // Workflow creation — sequential settings
  "wf_new_title": "✨ *Neuer Workflow*\n\n{desc}",
  "wf_no_products_workflow":
    "❌ Du hast noch kein Produkt. Ohne Produkt können wir keine Bilder erzeugen.\n\nLege eines an mit /newproduct oder im Web-Dashboard, dann starte den Workflow erneut.",
  "wf_product_confirm_suggested":
    "📦 *Produkt*\n\nIch schlage vor: *{name}*\n\nStimmt das für diesen Workflow?",
  "wf_product_confirm_pick":
    "📦 *Produkt*\n\nWelches Produkt soll für die Generierung verwendet werden? Tippe unten auf den Namen.",
  "wf_product_confirm_yes": "✅ Ja, passt",
  "wf_product_confirm_other": "📋 Anderes wählen",
  "wf_summary_product": "📦 Produkt: {name}",
  "wf_summary_product_none": "📦 Produkt: —",
  "wf_product_selected": "Produkt gewählt ✓",
  "wf_select_model": "Welches Model soll verwendet werden?",
  "wf_select_background": "Welcher Hintergrund?",
  "wf_select_language": "Welche Sprache für die Inhalte?",
  "wf_no_model": "⏩ Keins",
  "wf_no_background": "⏩ Standard-BG",
  "wf_model_selected": "Model gewählt ✓",
  "wf_bg_selected": "Hintergrund gewählt ✓",
  "wf_lang_selected": "Sprache: {lang} ✓",
  "wf_summary": "✨ *Workflow-Zusammenfassung*\n\n📝 {desc}\n\n{settings}",
  "wf_summary_model": "👤 Model: {name}",
  "wf_summary_model_none": "👤 Model: Keins",
  "wf_summary_bg": "🖼 Hintergrund: {name}",
  "wf_summary_bg_none": "🖼 Hintergrund: Standard",
  "wf_summary_lang": "🌐 Sprache: {lang}",
  "wf_confirm_btn": "✅ Los",
  "wf_change_btn": "✏️ Ändern",
  "wf_creating": "⏳ Erstelle Workflow und plane Schritte …",
  "wf_creation_failed": "❌ Workflow-Erstellung fehlgeschlagen. Bitte versuche es erneut.",
  "wf_no_pending": "Kein Workflow gefunden",

  // Workflow plan review
  "wf_step_label": "{emoji} *Schritt {n}: {title}*\n{desc}",
  "wf_step_ok_btn": "✓ OK",
  "wf_step_replan_btn": "↻ Andere Pose",
  "wf_step_confirmed": "Schritt {n} bestätigt ✓",
  "wf_step_replanning": "Plane Schritt neu …",
  "wf_step_replan_failed": "❌ Neuplanung von Schritt {n} fehlgeschlagen.",
  "wf_no_active": "Kein aktiver Workflow",
  "wf_plan_done": "Plan fertig! Was möchtest du tun?",
  "wf_gen_all_btn": "▶ Alle generieren",
  "wf_gen_step_btn": "🎨 Schritt {n} generieren",

  // Generation
  "gen_starting": "🚀 Starte Generierung für {n} Schritte …",
  "gen_progress": "🎨 Generiere Bild {current}/{total} …",
  "gen_single": "🎨 Generiere Schritt {n} …",
  "gen_quota_exceeded": "❌ Quota erschöpft ({used}/{limit}). Upgrade deinen Plan.",
  "gen_no_product": "❌ Kein Produkt gefunden. Lege zuerst ein Produkt an.",
  "gen_step_done": "✅ Schritt {n} abgeschlossen (kein Bild verfügbar).",
  "gen_step_failed": "❌ Generierung von Schritt {n} fehlgeschlagen.",
  "gen_resume_controls":
    "ℹ️ *Weiter im Workflow*\n\nDu bleibst in diesem Workflow. Nutze die Buttons, um fehlgeschlagene Schritte erneut zu starten oder mit dem nächsten Bild fortzufahren.",
  "gen_image_send_failed": "✅ Schritt {n} generiert, aber Bild konnte nicht gesendet werden.",
  "gen_all_done": "✅ Alle Schritte generiert!",
  "gen_image_caption": "Bild {current}/{total} generiert ✅\nSchritt {n}: {title}",
  "gen_image_caption_single": "Schritt {n}: {title}",

  // Post-generation buttons
  "gen_keep_btn": "👍 Behalten",
  "gen_regen_btn": "🔄 Neu generieren",
  "gen_next_btn": "▶ Nächstes generieren",
  "gen_remaining_btn": "⏩ Alle restlichen",
  "gen_overview_btn": "📋 Zurück zur Übersicht",
  "gen_colors_btn": "🎨 Farben generieren",
  "gen_colors_done": "🎨 {count} Farbvarianten generiert für Schritt {n}. Schau sie dir an:\n🔗 {url}",
  "gen_colors_no_colors": "Dieses Produkt hat keine Farben definiert. Füge Farben in den Produkteinstellungen hinzu.",
  "gen_colors_generating": "🎨 Generiere Farbvarianten für Schritt {n}…",
  "gen_colors_failed": "❌ Farbgenerierung fehlgeschlagen.",
  "gen_colors_quota": "Nicht genug Credits für Farbvarianten ({needed} benötigt, {remaining} übrig).",
  "gen_kept": "Schritt {n} behalten ✓",
  "gen_regenerating": "Generiere neu …",
  "gen_upscale_btn": "⬆ 4K",
  "gen_upscaling": "⬆ Skaliere auf 4K …",
  "gen_upscale_done": "✅ Schritt {n} auf 4K hochskaliert.",
  "gen_upscale_failed": "❌ 4K-Upscale fehlgeschlagen.",
  "gen_upscale_unavailable": "Upscaler ist auf diesem Server nicht verfügbar.",

  // Workflow list
  "wf_list_title": "📋 *Deine Workflows*",
  "wf_list_empty": "Du hast noch keine Workflows. Beschreibe einfach was du brauchst!",
  "wf_list_item": "• *{name}*\n  Status: {status} · {done}/{total} Schritte generiert",
  "wf_list_deep_link": "Details im Dashboard ansehen:",

  // Model creation
  "model_start": "👤 *Neues Model anlegen*\n\nWelche Art?",
  "model_human_btn": "📷 Echtes Model",
  "model_ai_btn": "🤖 KI-Model",
  "model_name_prompt": "Wie soll das Model heißen?",
  "model_freetext_prompt": "Beschreibe das Aussehen des Models frei (z.B. \"Junge Frau, sportlich, dunkle Haare\"):",
  "model_gender_prompt": "Geschlecht?",
  "model_gender_female": "Weiblich",
  "model_gender_male": "Männlich",
  "model_gender_nb": "Non-Binary",
  "model_gender_any": "Egal",
  "model_age_prompt": "Altersgruppe?",
  "model_age_any": "Egal",
  "model_build_prompt": "Körperbau?",
  "model_build_slim": "Schlank",
  "model_build_athletic": "Sportlich",
  "model_build_average": "Durchschnittlich",
  "model_build_curvy": "Kurvig",
  "model_build_plussize": "Plus-Size",
  "model_build_muscular": "Muskulös",
  "model_build_any": "Egal",
  "model_hair_prompt": "Haarlänge?",
  "model_hair_short": "Kurz",
  "model_hair_medium": "Mittel",
  "model_hair_long": "Lang",
  "model_hair_verylong": "Sehr lang",
  "model_hair_shaved": "Rasiert",
  "model_hair_any": "Egal",
  "model_created": "✅ Model *{name}* wurde angelegt!",
  "model_creation_failed": "❌ Model konnte nicht angelegt werden.",
  "model_upload_hint": "📷 Lade Referenzbilder im Dashboard hoch:\n🔗 {url}",
  "model_notes_prompt": "Notizen zum Model? (optional — sende \"skip\" zum Überspringen)",

  // Background creation
  "bg_start": "🖼 *Neuer Hintergrund anlegen*\n\nWelcher Typ?",
  "bg_canvas_btn": "🎨 Canvas",
  "bg_freestyle_btn": "✍️ Freestyle",
  "bg_upload_btn": "📤 Upload",
  "bg_name_prompt": "Name für den Hintergrund?",
  "bg_desc_prompt": "Beschreibe den Hintergrund (z.B. \"Minimalistisches Yoga-Studio, natürliches Licht\"):",
  "bg_upload_prompt": "Sende ein Bild für den Hintergrund (JPEG, PNG, WebP).",
  "bg_created": "✅ Hintergrund *{name}* wurde angelegt!",
  "bg_creation_failed": "❌ Hintergrund konnte nicht angelegt werden.",
  "bg_upload_hint": "📤 Bild hochladen im Dashboard:\n🔗 {url}",

  // Product creation
  "prod_start": "📦 *Neues Produkt anlegen*",
  "prod_name_prompt": "Wie heißt das Produkt?",
  "prod_brand_prompt": "Welche Marke?",
  "prod_brand_new": "➕ Neue Marke",
  "prod_brand_name_prompt": "Name der neuen Marke?",
  "prod_category_prompt": "Produktkategorie?",
  "prod_cat_handheld": "Handheld",
  "prod_cat_wearable": "Tragbar",
  "prod_cat_furniture": "Möbel",
  "prod_cat_outdoor": "Outdoor",
  "prod_cat_kitchen": "Küche",
  "prod_cat_beauty": "Beauty",
  "prod_cat_decor": "Deko",
  "prod_cat_fitness": "Fitness",
  "prod_cat_generic": "Allgemein",
  "prod_desc_prompt": "Kurze Beschreibung? (optional — sende \"skip\")",
  "prod_created": "✅ Produkt *{name}* wurde angelegt!",
  "prod_creation_failed": "❌ Produkt konnte nicht angelegt werden.",
  "prod_detail_link": "Bilder & Details im Dashboard bearbeiten:\n🔗 {url}",
  "prod_no_brands": "Du hast noch keine Marke. Soll ich eine anlegen?",
  "prod_no_brands_yes": "✅ Ja, Marke anlegen",

  // New workflow prompt
  "newworkflow_prompt": "✨ Beschreibe, was du erstellen möchtest.\n\nZ.B. \"10 Lifestyle-Bilder für eine Yogamatte\" oder sende eine Sprachnachricht.",

  // Product list
  "prod_list_title": "📦 *Deine Produkte*",
  "prod_list_empty": "Du hast noch keine Produkte.\nNutze /newproduct um eins anzulegen.",
  "prod_list_item": "• *{name}*\n  Kategorie: {category} · Status: {status}",

  // Model list
  "model_list_title": "👤 *Deine Models*",
  "model_list_empty": "Du hast noch keine Models.\nNutze /newmodel um eins anzulegen.",
  "model_list_item": "• *{name}*\n  Typ: {source}",

  // Background list
  "bg_list_title": "🖼 *Deine Hintergründe*",
  "bg_list_empty": "Du hast noch keine Hintergründe.\nNutze /newbackground um einen anzulegen.",
  "bg_list_item": "• *{name}*\n  Typ: {type}",

  "resource_list_localhost_urls_footer":
    "\n\n_(Lokal)_ Telegram erlaubt keine localhost-URLs als Schaltflächen. Kopiere diese Links in den Browser:\n\n",

  // Trash
  "trash_status": "🗑️ *Papierkorb*\n\n{total} gelöschte Items:\n• {workflows} Workflows\n• {products} Produkte\n• {models} Models\n• {backgrounds} Hintergründe\n\nItems werden nach 7 Tagen automatisch gelöscht.\n\n🔗 {url}",
  "trash_moved": "🗑️ In Papierkorb verschoben. 7 Tage zum Wiederherstellen.",

  // Shared
  "skip": "skip",
  "retry_btn": "🔄 Nochmal versuchen",
};

const en: MessageMap = {
  // General
  "welcome_back": "👋 Welcome back, {name}!\n\nYour account is linked.",
  "welcome_new": "👋 Welcome to GripShot!\n\nTo use the bot, link your account:\n\n🔗 {url}\n\nThe link is valid for 15 minutes.",
  "not_linked": "🔗 Your Telegram account is not linked yet.\nUse /start to get started.",
  "unknown_command": "Unknown command. Use /help for an overview.",
  "processing_error": "❌ Could not process message. Please try again.",
  "workspace_not_found": "❌ Workspace not found. Contact support.",
  "cancelled": "❌ Cancelled.",
  "flow_cancelled": "✅ Action cancelled. What would you like to do next?",

  // Status
  "status_title": "📊 *Status*\n\nPlan: {plan}\nCredits: {remaining} of {limit} remaining\nUsed: {used}\n\n📦 {products} Products · 👤 {models} Models · 🖼 {backgrounds} Backgrounds",

  // Help
  "help": "🤖 *GripShot Bot — Help*\n\n" +
    "*Commands:*\n" +
    "/start — Link account\n" +
    "/status — Plan, credits & overview\n" +
    "/dashboard — Open web dashboard\n" +
    "/settings — Open settings\n\n" +
    "*Workflows:*\n" +
    "/newworkflow — Start new workflow\n" +
    "/workflows — View workflows\n\n" +
    "*Resources:*\n" +
    "/products — View products\n" +
    "/models — View models\n" +
    "/backgrounds — View backgrounds\n" +
    "/newproduct — Create new product\n" +
    "/newmodel — Create new model\n" +
    "/newbackground — Create new background\n\n" +
    "/trash — View trash\n" +
    "/cancel — Cancel current action\n" +
    "/help — This help\n\n" +
    "✨ *Workflows via chat*\n" +
    "Just describe what you need, e.g.:\n" +
    '\"Create 10 Pilates exercises with mini ball\"\n\n' +
    "🎤 *Voice messages*\n" +
    "Send a voice message — the bot will transcribe it.",

  // Voice
  "voice_transcribing": "🎧 Transcribing voice message …",
  "voice_transcription_failed": "❌ Transcription failed. Please try again.",
  "voice_no_file": "❌ Could not read audio file.",
  "voice_result": "🗣️ *Recognized text:*\n\n{text}",
  "voice_confirmed": "✅ Confirmed — processing …",
  "voice_edit_prompt": "✏️ Please send the corrected text as your next message.",
  "voice_confirm_btn": "✅ Yes, go",
  "voice_edit_btn": "✏️ Edit",
  "voice_cancel_btn": "❌ Cancel",

  // Deep links
  "dashboard_link": "📊 Open your dashboard:\n\n🔗 {url}",
  "settings_link": "⚙️ Open settings:\n\n🔗 {url}",
  "results_link": "📸 View results:\n\n🔗 {url}",

  // Intent routing
  "intent_question": "💡 Use /status or /help for info. Or open the dashboard.",
  "intent_feedback": "📝 Feedback noted! Use the buttons below images.",
  "intent_unclear": "I'm not sure what you want. Describe what images you'd like, or use /help.",

  // Workflow creation — sequential settings
  "wf_new_title": "✨ *New Workflow*\n\n{desc}",
  "wf_no_products_workflow":
    "❌ You don't have a product yet. We need a product to generate images.\n\nCreate one with /newproduct or in the web dashboard, then start the workflow again.",
  "wf_product_confirm_suggested":
    "📦 *Product*\n\nI'll use: *{name}*\n\nIs that correct for this workflow?",
  "wf_product_confirm_pick":
    "📦 *Product*\n\nWhich product should we use for generation? Tap a name below.",
  "wf_product_confirm_yes": "✅ Yes, correct",
  "wf_product_confirm_other": "📋 Choose another",
  "wf_summary_product": "📦 Product: {name}",
  "wf_summary_product_none": "📦 Product: —",
  "wf_product_selected": "Product selected ✓",
  "wf_select_model": "Which model should be used?",
  "wf_select_background": "Which background?",
  "wf_select_language": "Which language for the content?",
  "wf_no_model": "⏩ None",
  "wf_no_background": "⏩ Default BG",
  "wf_model_selected": "Model selected ✓",
  "wf_bg_selected": "Background selected ✓",
  "wf_lang_selected": "Language: {lang} ✓",
  "wf_summary": "✨ *Workflow Summary*\n\n📝 {desc}\n\n{settings}",
  "wf_summary_model": "👤 Model: {name}",
  "wf_summary_model_none": "👤 Model: None",
  "wf_summary_bg": "🖼 Background: {name}",
  "wf_summary_bg_none": "🖼 Background: Default",
  "wf_summary_lang": "🌐 Language: {lang}",
  "wf_confirm_btn": "✅ Go",
  "wf_change_btn": "✏️ Change",
  "wf_creating": "⏳ Creating workflow and planning steps …",
  "wf_creation_failed": "❌ Workflow creation failed. Please try again.",
  "wf_no_pending": "No workflow found",

  // Workflow plan review
  "wf_step_label": "{emoji} *Step {n}: {title}*\n{desc}",
  "wf_step_ok_btn": "✓ OK",
  "wf_step_replan_btn": "↻ Different pose",
  "wf_step_confirmed": "Step {n} confirmed ✓",
  "wf_step_replanning": "Re-planning step …",
  "wf_step_replan_failed": "❌ Re-planning step {n} failed.",
  "wf_no_active": "No active workflow",
  "wf_plan_done": "Plan ready! What do you want to do?",
  "wf_gen_all_btn": "▶ Generate all",
  "wf_gen_step_btn": "🎨 Generate step {n}",

  // Generation
  "gen_starting": "🚀 Starting generation for {n} steps …",
  "gen_progress": "🎨 Generating image {current}/{total} …",
  "gen_single": "🎨 Generating step {n} …",
  "gen_quota_exceeded": "❌ Quota exhausted ({used}/{limit}). Upgrade your plan.",
  "gen_no_product": "❌ No product found. Create a product first.",
  "gen_step_done": "✅ Step {n} completed (no image available).",
  "gen_step_failed": "❌ Generation of step {n} failed.",
  "gen_resume_controls":
    "ℹ️ *Continue this workflow*\n\nYou are still in this workflow. Use the buttons to retry a failed step or continue with the next image.",
  "gen_image_send_failed": "✅ Step {n} generated, but image could not be sent.",
  "gen_all_done": "✅ All steps generated!",
  "gen_image_caption": "Image {current}/{total} generated ✅\nStep {n}: {title}",
  "gen_image_caption_single": "Step {n}: {title}",

  // Post-generation buttons
  "gen_keep_btn": "👍 Keep",
  "gen_regen_btn": "🔄 Regenerate",
  "gen_next_btn": "▶ Generate next",
  "gen_remaining_btn": "⏩ All remaining",
  "gen_overview_btn": "📋 Back to overview",
  "gen_colors_btn": "🎨 Generate colors",
  "gen_colors_done": "🎨 {count} color variants generated for step {n}. View them here:\n🔗 {url}",
  "gen_colors_no_colors": "This product has no colors defined. Add colors in product settings.",
  "gen_colors_generating": "🎨 Generating color variants for step {n}…",
  "gen_colors_failed": "❌ Color generation failed.",
  "gen_colors_quota": "Not enough credits for color variants ({needed} needed, {remaining} remaining).",
  "gen_kept": "Step {n} kept ✓",
  "gen_regenerating": "Regenerating …",
  "gen_upscale_btn": "⬆ 4K",
  "gen_upscaling": "⬆ Upscaling to 4K …",
  "gen_upscale_done": "✅ Step {n} upscaled to 4K.",
  "gen_upscale_failed": "❌ 4K upscale failed.",
  "gen_upscale_unavailable": "Upscaler is not available on this server.",

  // Workflow list
  "wf_list_title": "📋 *Your Workflows*",
  "wf_list_empty": "You have no workflows yet. Just describe what you need!",
  "wf_list_item": "• *{name}*\n  Status: {status} · {done}/{total} steps generated",
  "wf_list_deep_link": "View details in dashboard:",

  // Model creation
  "model_start": "👤 *Create New Model*\n\nWhich type?",
  "model_human_btn": "📷 Real Model",
  "model_ai_btn": "🤖 AI Model",
  "model_name_prompt": "What should the model be called?",
  "model_freetext_prompt": "Describe the model's appearance freely (e.g. \"Young woman, athletic, dark hair\"):",
  "model_gender_prompt": "Gender?",
  "model_gender_female": "Female",
  "model_gender_male": "Male",
  "model_gender_nb": "Non-Binary",
  "model_gender_any": "Any",
  "model_age_prompt": "Age range?",
  "model_age_any": "Any",
  "model_build_prompt": "Body build?",
  "model_build_slim": "Slim",
  "model_build_athletic": "Athletic",
  "model_build_average": "Average",
  "model_build_curvy": "Curvy",
  "model_build_plussize": "Plus-Size",
  "model_build_muscular": "Muscular",
  "model_build_any": "Any",
  "model_hair_prompt": "Hair length?",
  "model_hair_short": "Short",
  "model_hair_medium": "Medium",
  "model_hair_long": "Long",
  "model_hair_verylong": "Very long",
  "model_hair_shaved": "Shaved",
  "model_hair_any": "Any",
  "model_created": "✅ Model *{name}* has been created!",
  "model_creation_failed": "❌ Could not create model.",
  "model_upload_hint": "📷 Upload reference photos in the dashboard:\n🔗 {url}",
  "model_notes_prompt": "Notes about the model? (optional — send \"skip\" to skip)",

  // Background creation
  "bg_start": "🖼 *Create New Background*\n\nWhich type?",
  "bg_canvas_btn": "🎨 Canvas",
  "bg_freestyle_btn": "✍️ Freestyle",
  "bg_upload_btn": "📤 Upload",
  "bg_name_prompt": "Name for the background?",
  "bg_desc_prompt": "Describe the background (e.g. \"Minimalist yoga studio, natural light\"):",
  "bg_upload_prompt": "Send an image for the background (JPEG, PNG, WebP).",
  "bg_created": "✅ Background *{name}* has been created!",
  "bg_creation_failed": "❌ Could not create background.",
  "bg_upload_hint": "📤 Upload image in dashboard:\n🔗 {url}",

  // Product creation
  "prod_start": "📦 *Create New Product*",
  "prod_name_prompt": "What is the product called?",
  "prod_brand_prompt": "Which brand?",
  "prod_brand_new": "➕ New brand",
  "prod_brand_name_prompt": "Name of the new brand?",
  "prod_category_prompt": "Product category?",
  "prod_cat_handheld": "Handheld",
  "prod_cat_wearable": "Wearable",
  "prod_cat_furniture": "Furniture",
  "prod_cat_outdoor": "Outdoor",
  "prod_cat_kitchen": "Kitchen",
  "prod_cat_beauty": "Beauty",
  "prod_cat_decor": "Decor",
  "prod_cat_fitness": "Fitness",
  "prod_cat_generic": "General",
  "prod_desc_prompt": "Short description? (optional — send \"skip\")",
  "prod_created": "✅ Product *{name}* has been created!",
  "prod_creation_failed": "❌ Could not create product.",
  "prod_detail_link": "Edit images & details in the dashboard:\n🔗 {url}",
  "prod_no_brands": "You don't have any brands yet. Want me to create one?",
  "prod_no_brands_yes": "✅ Yes, create brand",

  // New workflow prompt
  "newworkflow_prompt": "✨ Describe what you want to create.\n\nE.g. \"10 lifestyle shots for a yoga mat\" or send a voice message.",

  // Product list
  "prod_list_title": "📦 *Your Products*",
  "prod_list_empty": "You don't have any products yet.\nUse /newproduct to create one.",
  "prod_list_item": "• *{name}*\n  Category: {category} · Status: {status}",

  // Model list
  "model_list_title": "👤 *Your Models*",
  "model_list_empty": "You don't have any models yet.\nUse /newmodel to create one.",
  "model_list_item": "• *{name}*\n  Type: {source}",

  // Background list
  "bg_list_title": "🖼 *Your Backgrounds*",
  "bg_list_empty": "You don't have any backgrounds yet.\nUse /newbackground to create one.",
  "bg_list_item": "• *{name}*\n  Type: {type}",

  "resource_list_localhost_urls_footer":
    "\n\n_(Local)_ Telegram cannot use localhost URLs as buttons. Copy these links into your browser:\n\n",

  // Trash
  "trash_status": "🗑️ *Trash*\n\n{total} deleted items:\n• {workflows} Workflows\n• {products} Products\n• {models} Models\n• {backgrounds} Backgrounds\n\nItems are automatically deleted after 7 days.\n\n🔗 {url}",
  "trash_moved": "🗑️ Moved to trash. 7 days to restore.",

  // Shared
  "skip": "skip",
  "retry_btn": "🔄 Try again",
};

const messages: Record<BotLocale, MessageMap> = { de, en };

/**
 * Look up a bot message by key and locale, substituting {placeholder} tokens.
 * Falls back to German if the key is missing in the requested locale.
 */
export function t(
  key: string,
  locale: BotLocale = "de",
  vars?: Record<string, string | number>,
): string {
  let text = messages[locale]?.[key] ?? messages.de[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/** Resolve the bot locale from a UserDoc's preferredLocale field. */
export function resolveLocale(preferredLocale?: string): BotLocale {
  return preferredLocale === "en" ? "en" : "de";
}
