# Edit plan: each phrase = (voice text, on-screen caption, [(clip_id, crop_x_center 0-1, start_sec), ...], target shot length)
BEATS = [
  # 1 HOOK - fast cuts (~0.7 s)
  [("Hindi pantay ang sahig.", "Hindi pantay ang sahig.", [("43033",0.5,1.0),("1445",0.55,3.0),("1446",0.6,8.0)], 0.7),
   ("Pero pantay ang cabinets.", "Pero pantay ang cabinets.", [("3091",0.45,2.0),("39692",0.5,2.0),("39695",0.5,3.0)], 0.7),
   ("Paano?", "Paano?", [("39684",0.45,2.0)], 0.7)],
  # 2 PROBLEM
  [("Karamihan ng sahig at pader, hindi tuwid.", "Hindi tuwid ang sahig at pader", [("33436",0.55,2.0),("44859",0.55,4.0)], 1.2),
   ("Kaya 'yung ibang cabinets, may siwang,", "May siwang", [("5710",0.62,1.0),("44859",0.6,9.0)], 1.2),
   ("tagilid ang pinto,", "Tagilid ang pinto", [("5804",0.5,4.0)], 1.2),
   ("ayaw sumara ng drawer.", "Ayaw sumara ng drawer", [("33436",0.55,7.0)], 1.2)],
  # 3 SHOP (Lexie Wood's edge)
  [("Sa Lexie Wood, nagsisimula 'yan bago pa kami pumunta sa site.", "Nagsisimula sa shop", [("44861",0.4,2.0),("39696",0.5,3.0),("771",0.6,6.0)], 1.2),
   ("Chine-check ng CAD team ang plan.", "CAD check ng plan", [("30000",0.5,3.0),("29997",0.5,5.0),("16556",0.5,6.0)], 1.2),
   ("Tapos CNC ang nag-cut ng bawat piyesa,", "CNC cut, bawat piyesa", [("46355",0.5,3.0),("39690",0.5,2.0),("2250",0.4,2.0),("39695",0.5,6.0)], 1.2),
   ("may label pa.", "May label pa", [("1455",0.55,1.5),("1446",0.6,11.0)], 1.2)],
  # 4 BASE + LEVEL + TOE KICK
  [("Sa site, base muna.", "Base muna", [("1445",0.5,6.0),("39700",0.5,3.0)], 1.2),
   ("Pinapantay namin gamit ang level.", "Pantay muna", [("39684",0.4,4.5),("1445",0.5,8.5)], 1.2),
   ("Tinatabas ang toe kick para sumakto sa sahig.", "Tabas para sumakto", [("39699",0.4,8.0),("39691",0.5,4.0),("45146",0.5,6.0)], 1.2)],
  # 5 JOIN + WALL
  [("Pinagdidikit ang mga box gamit ang clamps,", "Dikit. Higpit.", [("44858",0.5,1.0),("44857",0.5,2.0)], 1.2),
   ("tapos kinakabit nang matibay sa pader.", "Kabit sa pader", [("39692",0.5,5.0),("777",0.5,10.0),("44858",0.55,5.5)], 1.2)],
  # 6 FRONTS
  [("Huli, ang mga pinto at drawer.", "Pinto at drawer", [("15853",0.45,3.0),("13174",0.4,2.0)], 1.2),
   ("Inaayos namin isa-isa hanggang pare-pareho ang siwang.", "Isa-isa, hanggang pantay", [("15851",0.4,2.0),("5804",0.5,8.0),("15853",0.6,10.0)], 1.2)],
  # 7 SHATTER - one cut per word on the last line, then loop back to the opening frame
  [("Hindi swerte ang perfect fit.", "Hindi swerte ang perfect fit", [("3090",0.5,2.0),("3091",0.55,6.0)], 1.2),
   ("Sukat.", "Sukat.", [("1445",0.5,7.0)], 9),
   ("Check.", "Sukat. Check.", [("30000",0.5,6.0)], 9),
   ("Cut.", "Sukat. Check. Cut.", [("39695",0.5,8.0)], 9),
   ("Ayos.", "Sukat. Check. Cut. Ayos.", [("43033",0.5,1.0)], 9)],
]
PHRASE_GAP = 0.12
BEAT_GAP = 0.28
TAIL = 1.0   # end hold on the opening shot so the loop is seamless
