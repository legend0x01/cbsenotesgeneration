/* =========================================================================
 * NCERT CURRICULUM — Classes 9 to 12 (rationalised NCERT textbooks)
 * Structure: CURRICULUM[class][subject] = [ { book, chapters: [...] } ]
 * Chapter numbers follow each book's own order.
 * ========================================================================= */
const CURRICULUM = {
  "9": {
    "Mathematics": [
      { book: "Mathematics", chapters: [
        "Number Systems", "Polynomials", "Coordinate Geometry", "Linear Equations in Two Variables",
        "Introduction to Euclid's Geometry", "Lines and Angles", "Triangles", "Quadrilaterals",
        "Circles", "Heron's Formula", "Surface Areas and Volumes", "Statistics"
      ]}
    ],
    "Science": [
      { book: "Science", chapters: [
        "Matter in Our Surroundings", "Is Matter Around Us Pure?", "Atoms and Molecules",
        "Structure of the Atom", "The Fundamental Unit of Life", "Tissues", "Motion",
        "Force and Laws of Motion", "Gravitation", "Work and Energy", "Sound",
        "Improvement in Food Resources"
      ]}
    ],
    "History": [
      { book: "India and the Contemporary World – I", chapters: [
        "The French Revolution", "Socialism in Europe and the Russian Revolution",
        "Nazism and the Rise of Hitler", "Forest Society and Colonialism",
        "Pastoralists in the Modern World"
      ]}
    ],
    "Geography": [
      { book: "Contemporary India – I", chapters: [
        "India – Size and Location", "Physical Features of India", "Drainage", "Climate",
        "Natural Vegetation and Wildlife", "Population"
      ]}
    ],
    "Political Science": [
      { book: "Democratic Politics – I", chapters: [
        "What is Democracy? Why Democracy?", "Constitutional Design", "Electoral Politics",
        "Working of Institutions", "Democratic Rights"
      ]}
    ],
    "Economics": [
      { book: "Economics", chapters: [
        "The Story of Village Palampur", "People as Resource", "Poverty as a Challenge",
        "Food Security in India"
      ]}
    ],
    "English": [
      { book: "Beehive", chapters: [
        "The Fun They Had", "The Sound of Music", "The Little Girl", "A Truly Beautiful Mind",
        "The Snake and the Mirror", "My Childhood", "Reach for the Top", "Kathmandu", "If I Were You",
        "Poem: The Road Not Taken", "Poem: Wind", "Poem: Rain on the Roof",
        "Poem: The Lake Isle of Innisfree", "Poem: A Legend of the Northland",
        "Poem: No Men Are Foreign", "Poem: On Killing a Tree", "Poem: A Slumber Did My Spirit Seal"
      ]},
      { book: "Moments", chapters: [
        "The Lost Child", "The Adventures of Toto", "Iswaran the Storyteller",
        "In the Kingdom of Fools", "The Happy Prince", "Weathering the Storm in Ersama",
        "The Last Leaf", "A House Is Not a Home", "The Beggar"
      ]}
    ]
  },

  "10": {
    "Mathematics": [
      { book: "Mathematics", chapters: [
        "Real Numbers", "Polynomials", "Pair of Linear Equations in Two Variables",
        "Quadratic Equations", "Arithmetic Progressions", "Triangles", "Coordinate Geometry",
        "Introduction to Trigonometry", "Some Applications of Trigonometry", "Circles",
        "Areas Related to Circles", "Surface Areas and Volumes", "Statistics", "Probability"
      ]}
    ],
    "Science": [
      { book: "Science", chapters: [
        "Chemical Reactions and Equations", "Acids, Bases and Salts", "Metals and Non-metals",
        "Carbon and its Compounds", "Life Processes", "Control and Coordination",
        "How do Organisms Reproduce?", "Heredity", "Light – Reflection and Refraction",
        "The Human Eye and the Colourful World", "Electricity",
        "Magnetic Effects of Electric Current", "Our Environment"
      ]}
    ],
    "History": [
      { book: "India and the Contemporary World – II", chapters: [
        "The Rise of Nationalism in Europe", "Nationalism in India", "The Making of a Global World",
        "The Age of Industrialisation", "Print Culture and the Modern World"
      ]}
    ],
    "Geography": [
      { book: "Contemporary India – II", chapters: [
        "Resources and Development", "Forest and Wildlife Resources", "Water Resources",
        "Agriculture", "Minerals and Energy Resources", "Manufacturing Industries",
        "Lifelines of National Economy"
      ]}
    ],
    "Political Science": [
      { book: "Democratic Politics – II", chapters: [
        "Power Sharing", "Federalism", "Gender, Religion and Caste", "Political Parties",
        "Outcomes of Democracy"
      ]}
    ],
    "Economics": [
      { book: "Understanding Economic Development", chapters: [
        "Development", "Sectors of the Indian Economy", "Money and Credit",
        "Globalisation and the Indian Economy", "Consumer Rights"
      ]}
    ],
    "English": [
      { book: "First Flight", chapters: [
        "A Letter to God", "Nelson Mandela: Long Walk to Freedom", "Two Stories about Flying",
        "From the Diary of Anne Frank", "Glimpses of India", "Mijbil the Otter",
        "Madam Rides the Bus", "The Sermon at Benares", "The Proposal",
        "Poem: Dust of Snow", "Poem: Fire and Ice", "Poem: A Tiger in the Zoo",
        "Poem: How to Tell Wild Animals", "Poem: The Ball Poem", "Poem: Amanda!",
        "Poem: The Trees", "Poem: Fog", "Poem: The Tale of Custard the Dragon",
        "Poem: For Anne Gregory"
      ]},
      { book: "Footprints without Feet", chapters: [
        "A Triumph of Surgery", "The Thief's Story", "The Midnight Visitor", "A Question of Trust",
        "Footprints without Feet", "The Making of a Scientist", "The Necklace", "The Hack Driver",
        "Bholi", "The Book That Saved the Earth"
      ]}
    ]
  },

  "11": {
    "Physics": [
      { book: "Physics Part I & II", chapters: [
        "Units and Measurement", "Motion in a Straight Line", "Motion in a Plane", "Laws of Motion",
        "Work, Energy and Power", "System of Particles and Rotational Motion", "Gravitation",
        "Mechanical Properties of Solids", "Mechanical Properties of Fluids",
        "Thermal Properties of Matter", "Thermodynamics", "Kinetic Theory", "Oscillations", "Waves"
      ]}
    ],
    "Chemistry": [
      { book: "Chemistry Part I & II", chapters: [
        "Some Basic Concepts of Chemistry", "Structure of Atom",
        "Classification of Elements and Periodicity in Properties",
        "Chemical Bonding and Molecular Structure", "Thermodynamics", "Equilibrium",
        "Redox Reactions", "Organic Chemistry – Some Basic Principles and Techniques", "Hydrocarbons"
      ]}
    ],
    "Biology": [
      { book: "Biology", chapters: [
        "The Living World", "Biological Classification", "Plant Kingdom", "Animal Kingdom",
        "Morphology of Flowering Plants", "Anatomy of Flowering Plants",
        "Structural Organisation in Animals", "Cell: The Unit of Life", "Biomolecules",
        "Cell Cycle and Cell Division", "Photosynthesis in Higher Plants", "Respiration in Plants",
        "Plant Growth and Development", "Breathing and Exchange of Gases",
        "Body Fluids and Circulation", "Excretory Products and their Elimination",
        "Locomotion and Movement", "Neural Control and Coordination",
        "Chemical Coordination and Integration"
      ]}
    ],
    "Mathematics": [
      { book: "Mathematics", chapters: [
        "Sets", "Relations and Functions", "Trigonometric Functions",
        "Complex Numbers and Quadratic Equations", "Linear Inequalities",
        "Permutations and Combinations", "Binomial Theorem", "Sequences and Series",
        "Straight Lines", "Conic Sections", "Introduction to Three Dimensional Geometry",
        "Limits and Derivatives", "Statistics", "Probability"
      ]}
    ],
    "Accountancy": [
      { book: "Financial Accounting – I", chapters: [
        "Introduction to Accounting", "Theory Base of Accounting", "Recording of Transactions – I",
        "Recording of Transactions – II", "Bank Reconciliation Statement",
        "Trial Balance and Rectification of Errors", "Depreciation, Provisions and Reserves",
        "Financial Statements – I", "Financial Statements – II"
      ]}
    ],
    "Business Studies": [
      { book: "Business Studies", chapters: [
        "Business, Trade and Commerce", "Forms of Business Organisation",
        "Public, Private and Global Enterprises", "Business Services", "Emerging Modes of Business",
        "Social Responsibilities of Business and Business Ethics", "Sources of Business Finance",
        "Small Business and Entrepreneurship", "Internal Trade", "International Business"
      ]}
    ],
    "Economics": [
      { book: "Statistics for Economics", chapters: [
        "Introduction", "Collection of Data", "Organisation of Data", "Presentation of Data",
        "Measures of Central Tendency", "Correlation", "Index Numbers", "Use of Statistical Tools"
      ]},
      { book: "Introductory Microeconomics", chapters: [
        "Introduction", "Theory of Consumer Behaviour", "Production and Costs",
        "The Theory of the Firm under Perfect Competition", "Market Equilibrium"
      ]}
    ],
    "History": [
      { book: "Themes in World History", chapters: [
        "From the Beginning of Time", "Writing and City Life", "An Empire Across Three Continents",
        "Nomadic Empires", "The Three Orders", "Displacing Indigenous Peoples",
        "Paths to Modernisation"
      ]}
    ],
    "Geography": [
      { book: "Fundamentals of Physical Geography", chapters: [
        "Geography as a Discipline", "The Origin and Evolution of the Earth", "Interior of the Earth",
        "Distribution of Oceans and Continents", "Geomorphic Processes",
        "Landforms and their Evolution", "Composition and Structure of Atmosphere",
        "Solar Radiation, Heat Balance and Temperature", "Atmospheric Circulation and Weather Systems",
        "Water in the Atmosphere", "World Climate and Climate Change", "Water (Oceans)",
        "Movements of Ocean Water", "Biodiversity and Conservation"
      ]},
      { book: "India: Physical Environment", chapters: [
        "India — Location", "Structure and Physiography", "Drainage System", "Climate",
        "Natural Vegetation", "Natural Hazards and Disasters"
      ]}
    ],
    "Political Science": [
      { book: "Indian Constitution at Work", chapters: [
        "Constitution: Why and How?", "Rights in the Indian Constitution",
        "Election and Representation", "Executive", "Legislature", "Judiciary", "Federalism",
        "Local Governments", "Constitution as a Living Document", "The Philosophy of the Constitution"
      ]},
      { book: "Political Theory", chapters: [
        "Political Theory: An Introduction", "Freedom", "Equality", "Social Justice", "Rights",
        "Citizenship", "Nationalism", "Secularism"
      ]}
    ],
    "English": [
      { book: "Hornbill", chapters: [
        "The Portrait of a Lady", "We're Not Afraid to Die… if We Can All Be Together",
        "Discovering Tut: the Saga Continues", "The Ailing Planet: the Green Movement's Role",
        "The Adventure", "Silk Road", "Poem: A Photograph", "Poem: The Laburnum Top",
        "Poem: The Voice of the Rain", "Poem: Childhood", "Poem: Father to Son"
      ]},
      { book: "Snapshots", chapters: [
        "The Summer of the Beautiful White Horse", "The Address", "Mother's Day", "Birth",
        "The Tale of Melon City"
      ]}
    ],
    "Computer Science": [
      { book: "Computer Science", chapters: [
        "Computer System", "Encoding Schemes and Number System", "Emerging Trends",
        "Introduction to Problem Solving", "Getting Started with Python", "Flow of Control",
        "Functions", "Strings", "Lists", "Tuples and Dictionaries", "Societal Impact"
      ]}
    ]
  },

  "12": {
    "Physics": [
      { book: "Physics Part I & II", chapters: [
        "Electric Charges and Fields", "Electrostatic Potential and Capacitance",
        "Current Electricity", "Moving Charges and Magnetism", "Magnetism and Matter",
        "Electromagnetic Induction", "Alternating Current", "Electromagnetic Waves",
        "Ray Optics and Optical Instruments", "Wave Optics", "Dual Nature of Radiation and Matter",
        "Atoms", "Nuclei", "Semiconductor Electronics: Materials, Devices and Simple Circuits"
      ]}
    ],
    "Chemistry": [
      { book: "Chemistry Part I & II", chapters: [
        "Solutions", "Electrochemistry", "Chemical Kinetics", "The d- and f-Block Elements",
        "Coordination Compounds", "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers",
        "Aldehydes, Ketones and Carboxylic Acids", "Amines", "Biomolecules"
      ]}
    ],
    "Biology": [
      { book: "Biology", chapters: [
        "Sexual Reproduction in Flowering Plants", "Human Reproduction", "Reproductive Health",
        "Principles of Inheritance and Variation", "Molecular Basis of Inheritance", "Evolution",
        "Human Health and Disease", "Microbes in Human Welfare",
        "Biotechnology: Principles and Processes", "Biotechnology and its Applications",
        "Organisms and Populations", "Ecosystem", "Biodiversity and Conservation"
      ]}
    ],
    "Mathematics": [
      { book: "Mathematics Part I & II", chapters: [
        "Relations and Functions", "Inverse Trigonometric Functions", "Matrices", "Determinants",
        "Continuity and Differentiability", "Application of Derivatives", "Integrals",
        "Application of Integrals", "Differential Equations", "Vector Algebra",
        "Three Dimensional Geometry", "Linear Programming", "Probability"
      ]}
    ],
    "Accountancy": [
      { book: "Accountancy Part I & II", chapters: [
        "Accounting for Not-for-Profit Organisation", "Accounting for Partnership: Basic Concepts",
        "Reconstitution of a Partnership Firm – Admission of a Partner",
        "Reconstitution of a Partnership Firm – Retirement/Death of a Partner",
        "Dissolution of Partnership Firm", "Accounting for Share Capital",
        "Issue and Redemption of Debentures", "Financial Statements of a Company",
        "Analysis of Financial Statements", "Accounting Ratios", "Cash Flow Statement"
      ]}
    ],
    "Business Studies": [
      { book: "Business Studies Part I & II", chapters: [
        "Nature and Significance of Management", "Principles of Management", "Business Environment",
        "Planning", "Organising", "Staffing", "Directing", "Controlling", "Financial Management",
        "Financial Markets", "Marketing", "Consumer Protection"
      ]}
    ],
    "Economics": [
      { book: "Introductory Macroeconomics", chapters: [
        "Introduction", "National Income Accounting", "Money and Banking",
        "Determination of Income and Employment", "Government Budget and the Economy",
        "Open Economy Macroeconomics"
      ]},
      { book: "Indian Economic Development", chapters: [
        "Indian Economy on the Eve of Independence", "Indian Economy 1950–1990",
        "Liberalisation, Privatisation and Globalisation: An Appraisal",
        "Human Capital Formation in India", "Rural Development",
        "Employment: Growth, Informalisation and Other Issues",
        "Environment and Sustainable Development",
        "Comparative Development Experiences of India and its Neighbours"
      ]}
    ],
    "History": [
      { book: "Themes in Indian History I–III", chapters: [
        "Bricks, Beads and Bones: The Harappan Civilisation",
        "Kings, Farmers and Towns: Early States and Economies",
        "Kinship, Caste and Class: Early Societies",
        "Thinkers, Beliefs and Buildings: Cultural Developments",
        "Through the Eyes of Travellers: Perceptions of Society",
        "Bhakti–Sufi Traditions: Changes in Religious Beliefs and Devotional Texts",
        "An Imperial Capital: Vijayanagara", "Peasants, Zamindars and the State: Agrarian Society and the Mughal Empire",
        "Colonialism and the Countryside: Exploring Official Archives",
        "Rebels and the Raj: The Revolt of 1857 and its Representations",
        "Mahatma Gandhi and the Nationalist Movement: Civil Disobedience and Beyond",
        "Framing the Constitution: The Beginning of a New Era"
      ]}
    ],
    "Geography": [
      { book: "Fundamentals of Human Geography", chapters: [
        "Human Geography: Nature and Scope", "The World Population", "Human Development",
        "Primary Activities", "Secondary Activities", "Tertiary and Quaternary Activities",
        "Transport and Communication", "International Trade"
      ]},
      { book: "India: People and Economy", chapters: [
        "Population: Distribution, Density, Growth and Composition", "Human Settlements",
        "Land Resources and Agriculture", "Water Resources", "Mineral and Energy Resources",
        "Planning and Sustainable Development in Indian Context", "Transport and Communication",
        "International Trade", "Geographical Perspective on Selected Issues and Problems"
      ]}
    ],
    "Political Science": [
      { book: "Contemporary World Politics", chapters: [
        "The End of Bipolarity", "New Centres of Power", "Contemporary South Asia",
        "International Organisations", "Security in the Contemporary World",
        "Environment and Natural Resources", "Globalisation"
      ]},
      { book: "Politics in India Since Independence", chapters: [
        "Challenges of Nation Building", "Era of One-Party Dominance",
        "Politics of Planned Development", "India's External Relations",
        "Challenges to and Restoration of the Congress System", "The Crisis of Democratic Order",
        "Regional Aspirations", "Recent Developments in Indian Politics"
      ]}
    ],
    "English": [
      { book: "Flamingo", chapters: [
        "The Last Lesson", "Lost Spring", "Deep Water", "The Rattrap", "Indigo",
        "Poets and Pancakes", "The Interview", "Going Places", "Poem: My Mother at Sixty-six",
        "Poem: Keeping Quiet", "Poem: A Thing of Beauty", "Poem: A Roadside Stand",
        "Poem: Aunt Jennifer's Tigers"
      ]},
      { book: "Vistas", chapters: [
        "The Third Level", "The Tiger King", "Journey to the End of the Earth", "The Enemy",
        "On the Face of It", "Memories of Childhood"
      ]}
    ],
    "Computer Science": [
      { book: "Computer Science", chapters: [
        "Exception Handling in Python", "File Handling in Python", "Stack", "Queue", "Sorting",
        "Searching", "Understanding Data", "Database Concepts", "Structured Query Language (SQL)",
        "Computer Networks", "Data Communication", "Security Aspects"
      ]}
    ]
  }
};

/* Flatten into a searchable chapter list */
const NCERT_CHAPTERS = (() => {
  const list = [];
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (const cls of Object.keys(CURRICULUM)) {
    for (const subject of Object.keys(CURRICULUM[cls])) {
      for (const { book, chapters } of CURRICULUM[cls][subject]) {
        let prose = 0, poems = 0;
        chapters.forEach((title, i) => {
          const isPoem = title.startsWith('Poem: ');
          list.push({
            id: `c${cls}-${slug(subject)}-${slug(book)}-${i + 1}`,
            class: cls,
            subject,
            book,
            number: isPoem ? ++poems : ++prose,
            title: isPoem ? title.slice(6) : title,
            isPoem
          });
        });
      }
    }
  }
  return list;
})();
