
interface InstructionSet {
    steps: string[];
    proTip: string;
}

const DEFAULT_INSTRUCTION: InstructionSet = {
    steps: [
        "Positioniere dich stabil und sicher.",
        "Halte die Spannung in der Zielmuskulatur.",
        "Führe die Bewegung kontrolliert aus.",
        "Atme bei Belastung aus."
    ],
    proTip: "Qualität vor Quantität: Achte immer auf saubere Form."
};

const instructions: Record<string, InstructionSet> = {
    // Brust
    "Langhantel Bankdrücken": {
        steps: [
            "Lege dich auf die Bank, Füße fest am Boden.",
            "Greife die Stange etwas breiter als schulterbreit.",
            "Senke das Gewicht kontrolliert zur Brustmitte.",
            "Drücke explosiv nach oben, Rücken bleibt auf der Bank."
        ],
        proTip: "Halte die Schulterblätter zusammengezogen, um die Brust maximal zu aktivieren."
    },
    "Kurzhantel Bankdrücken": {
        steps: [
            "Lege dich mit den Hanteln auf die Flachbank.",
            "Starte mit gestreckten Armen über der Brust.",
            "Senke die Hanteln kontrolliert ab, bis eine leichte Dehnung spürbar ist.",
            "Drücke sie bogenförmig wieder zusammen."
        ],
        proTip: "Führe die Hanteln oben leicht zusammen für eine bessere Spitzenkontraktion."
    },
    "Langhantel Schrägbankdrücken": {
        steps: [
            "Stelle die Bank auf ca. 30-45 Grad ein.",
            "Greife die Stange schulterbreit.",
            "Senke die Stange zur oberen Brust ab.",
            "Drücke kontrolliert nach oben."
        ],
        proTip: "Achte darauf, dass die Ellenbogen nicht zu weit nach außen wandern."
    },
    "Kurzhantel Schrägbankdrücken": {
        steps: [
            "Stelle die Bank auf 30-45 Grad ein.",
            "Starte mit den Hanteln auf Schulterhöhe.",
            "Drücke die Hanteln gerade nach oben zusammen.",
            "Senke sie kontrolliert ab, bis eine Dehnung spürbar ist."
        ],
        proTip: "Vermeide das 'Zusammenknallen' der Hanteln oben, um Spannung zu halten."
    },
    "Butterfly (Maschine)": {
        steps: [
            "Setze dich aufrecht hin, Rücken ans Polster.",
            "Greife die Griffe auf Brusthöhe.",
            "Führe die Arme vor dem Körper zusammen.",
            "Halte kurz die Kontraktion und öffne langsam."
        ],
        proTip: "Stell dir vor, du würdest einen großen Baum umarmen."
    },
    "Maschine Brustpresse": {
        steps: [
            "Stelle die Sitzhöhe so ein, dass die Griffe auf Brusthöhe sind.",
            "Drücke die Griffe nach vorne, ohne die Schultern vorzuschieben.",
            "Kehre langsam in die Ausgangsposition zurück.",
            "Halte die Spannung im untersten Punkt."
        ],
        proTip: "Halte die Brust stolz rausgestreckt während der gesamten Bewegung."
    },

    // Rücken
    "Klimmzüge": {
        steps: [
            "Greife die Stange etwas breiter als schulterbreit.",
            "Ziehe die Schultern aktiv nach unten.",
            "Ziehe dich hoch, bis das Kinn über der Stange ist.",
            "Lasse dich kontrolliert ab."
        ],
        proTip: "Konzentriere dich darauf, die Ellbogen in die Hosentaschen zu ziehen."
    },
    "Latzug": {
        steps: [
            "Setze dich fest unter das Polster.",
            "Greife die Stange weit außen.",
            "Ziehe die Stange zur oberen Brust.",
            "Lehne dich nur minimal zurück."
        ],
        proTip: "Lasse die Arme oben komplett strecken für maximalen Stretch im Lat."
    },
    "Kabelzug Rudern": {
        steps: [
            "Setze dich mit leicht gebeugten Knien hin.",
            "Halte den Rücken gerade und aufrecht.",
            "Ziehe den Griff zum unteren Bauch.",
            "Führe die Schulterblätter hinten zusammen."
        ],
        proTip: "Vermeide Schwung aus dem unteren Rücken."
    },
    "Langhantel Rudern": {
        steps: [
            "Stehe hüftbreit, beuge dich mit geradem Rücken vor.",
            "Greife die Hantel schulterbreit.",
            "Ziehe die Stange Richtung Bauchnabel.",
            "Senke sie kontrolliert wieder ab."
        ],
        proTip: "Halte den Rücken fast parallel zum Boden für maximale Lat-Aktivierung."
    },

    // Beine
    "Langhantel Kniebeugen": {
        steps: [
            "Stange auf dem oberen Rücken ablegen.",
            "Füße schulterbreit, Zehen leicht nach außen.",
            "Setze dich tief nach hinten unten ab.",
            "Drücke dich aus den Fersen explosiv hoch."
        ],
        proTip: "Stelle dir vor, du schiebst den Boden weg. Knie bleiben stabil außen."
    },
    "Maschine Hackenschmidt Kniebeugen": {
        steps: [
            "Platziere die Schultern unter den Polstern.",
            "Füße mittig auf der Plattform.",
            "Gehe tief in die Hocke.",
            "Drücke das Gewicht über die Fersen hoch."
        ],
        proTip: "Gehe so tief wie möglich, solange die Fersen auf der Platte bleiben."
    },
    "Langhantel Kreuzheben": {
        steps: [
            "Stelle dich nah an die Stange (Schienbeine berühren sie fast).",
            "Greife die Stange etwas weiter als schulterbreit.",
            "Spanne den Lat an, Brust raus, Rücken gerade.",
            "Hebe das Gewicht durch Streckung von Hüfte und Beinen."
        ],
        proTip: "Die Stange sollte am gesamten Bein entlang gleiten."
    },
    "Beinpresse": {
        steps: [
            "Platziere die Füße mittig auf der Platte.",
            "Löse die Sicherung und senke das Gewicht ab.",
            "Gehe so tief wie möglich ohne Beckenbewegung.",
            "Drücke das Gewicht hoch, Knie nicht durchstrecken."
        ],
        proTip: "Drücke niemals die Knie komplett durch, um Gelenkbelastung zu vermeiden."
    },
    "Beinstrecker": {
        steps: [
            "Stelle das Polster auf das untere Schienbein ein.",
            "Drücke die Beine nach oben bis zur Streckung.",
            "Senke das Gewicht langsam ab.",
            "Halte den Po fest im Sitz."
        ],
        proTip: "Ziehe die Zehenspitzen an, um den Quadrizeps stärker zu isolieren."
    },
    "Beinbeuger": {
        steps: [
            "Stelle das Polster so ein, dass es an der Ferse anliegt.",
            "Beuge das Knie so weit wie möglich.",
            "Senke das Gewicht langsam ab.",
            "Halte die Hüfte unten."
        ],
        proTip: "Kicke nicht mit Schwung, arbeite aus der Hamstring-Kraft."
    },

    // Schultern
    "Langhantel Schulterdrücken": {
        steps: [
            "Stehe schulterbreit, Stange auf der Brust/Schulter.",
            "Drücke die Stange vertikal nach oben, Kopf leicht zurück.",
            "Strecke die Arme oben ganz durch.",
            "Senke kontrolliert zur Brust."
        ],
        proTip: "Spanne den Po an, um ein Hohlkreuz zu vermeiden."
    },
    "Kurzhantel Schulterdrücken": {
        steps: [
            "Setze dich aufrecht hin, Core angespannt.",
            "Starte mit Hanteln auf Ohrhöhe.",
            "Drücke die Hanteln bogenförmig nach oben.",
            "Senke sie kontrolliert wieder ab."
        ],
        proTip: "Drücke die Hanteln nicht ganz zusammen, um konstante Spannung zu halten."
    },
    "Kurzhantel Seitheben": {
        steps: [
            "Stehe leicht vorgebeugt, Knie soft.",
            "Hebe die Hanteln seitlich bis auf Schulterhöhe.",
            "Führe die Ellbogen, nicht die Hände.",
            "Senke langsam ab, nicht ganz ablegen."
        ],
        proTip: "Stell dir vor, du würdest zwei Karaffen Wasser ausgießen."
    },

    // Arme
    "Kurzhantel Bizeps Curls": {
        steps: [
            "Stehe aufrecht, Ellbogen fest am Körper.",
            "Drehe die Handflächen beim Hochgehen nach oben (Supination).",
            "Spanne den Bizeps oben maximal an.",
            "Lasse das Gewicht langsam ab."
        ],
        proTip: "Vermeide es, den Ellbogen nach vorne zu schieben."
    },
    "Langhantel Bizeps Curls": {
        steps: [
            "Greife die Stange schulterbreit im Untergriff.",
            "Halte die Ellbogen eng am Körper.",
            "Curle das Gewicht zur Brust.",
            "Senke es langsam ab."
        ],
        proTip: "Halte die Handgelenke gerade, nicht einknicken."
    },
    "Kabelzug Trizepsdrücken": {
        steps: [
            "Stehe stabil, Ellbogen fixiert am Körper.",
            "Drücke das Seil/Stange nach unten.",
            "Strecke die Arme unten komplett durch.",
            "Gehe langsam hoch bis Brusthöhe."
        ],
        proTip: "Spreize das Seil unten auseinander für maximale Trizeps-Kontraktion."
    }
};

export function getInstructionsForExercise(exerciseName: string): InstructionSet {
    if (!exerciseName) return DEFAULT_INSTRUCTION;

    // 1. Exact match
    if (instructions[exerciseName]) return instructions[exerciseName];

    // 2. Fuzzy match (Check if any key is contained in the exercise name)
    const key = Object.keys(instructions).find(k => exerciseName.toLowerCase().includes(k.toLowerCase()));
    if (key) return instructions[key];

    // 3. Reverse Fuzzy (Check if exercise name is contained in Key - for simple names)
    const reverseKey = Object.keys(instructions).find(k => k.toLowerCase().includes(exerciseName.toLowerCase()));
    if (reverseKey) return instructions[reverseKey];

    // 4. Keyword Heuristic
    const lower = exerciseName.toLowerCase();
    if (lower.includes("press") || lower.includes("drücken")) {
        return {
            steps: ["Stabiler Stand/Sitz.", "Kontrollierte Abwärtsbewegung.", "Explosives Drücken nach oben.", "Rücken neutral halten."],
            proTip: "Atme beim Drücken aus für mehr Stabilität."
        };
    }
    if (lower.includes("curl")) {
        return {
            steps: ["Ellbogen fixieren.", "Gewicht kontrolliert heben.", "Oben kurz halten.", "Langsame Negative."],
            proTip: "Kein Schwung aus dem Rücken holen."
        };
    }
    if (lower.includes("squat") || lower.includes("kniebeuge")) {
        return {
            steps: ["Füße schulterbreit.", "Rücken gerade halten.", "Tief setzen, Gewicht auf die Fersen.", "Explosiv hochdrücken."],
            proTip: "Knie bleiben stabil, nicht nach innen knicken."
        };
    }
    if (lower.includes("deadlift") || lower.includes("kreuzheben")) {
        return {
            steps: ["Stange nah am Körper.", "Rücken gerade, Brust raus.", "Aus den Beinen heben.", "Oben Hüfte strecken."],
            proTip: "Rücken niemals einrunden!"
        };
    }

    return DEFAULT_INSTRUCTION;
}
