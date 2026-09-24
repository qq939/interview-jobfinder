#!/usr/bin/env node
/**
 * Create tailored resume PDF for Software Engineer (AI) position
 * English only to avoid font issues
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');

// Output file
const outputFile = '/home/agent/.claude/workspace/project/uploads/resume_jiangzhicong_software_engineer_ai.pdf';

// Create PDF document
const doc = new PDFDocument({
  size: 'A4',
  margins: {
    top: 50,
    bottom: 50,
    left: 50,
    right: 50
  }
});

// Pipe output to file
const stream = fs.createWriteStream(outputFile);
doc.pipe(stream);

// Colors
const titleColor = '#1a1a2e';
const headingColor = '#16213e';
const accentColor = '#0f3460';
const textColor = '#333333';
const grayColor = '#666666';

// Helper function
function addSeparator() {
  doc.moveDown(0.3);
  doc.strokeColor('#dddddd')
     .lineWidth(0.5)
     .moveTo(50, doc.y)
     .lineTo(545, doc.y)
     .stroke();
  doc.moveDown(0.3);
}

// Start building PDF
let y = 50;

// Header - Name (English Pinyin)
doc.fontSize(28).font('Helvetica-Bold').fillColor(titleColor);
doc.text('JIANG Zhicong', 50, y, { align: 'center', width: 495 });
y += 35;

// Title
doc.fontSize(14).font('Helvetica').fillColor(accentColor);
doc.text('Software Engineer | AI/ML | Full-Stack Developer', { align: 'center', width: 495 });
y += 25;

// Contact info
doc.fontSize(10).font('Helvetica').fillColor(grayColor);
doc.text('Beijing, China | jiangzhicong2516@163.com | +86 17600192516', { align: 'center', width: 495 });
y += 20;

addSeparator();

// Professional Summary
doc.fontSize(12).font('Helvetica-Bold').fillColor(headingColor);
doc.text('PROFESSIONAL SUMMARY', { underline: true });
doc.moveDown(0.3);

doc.fontSize(10).font('Helvetica').fillColor(textColor);
const summary = `Passionate full-stack developer with deep interest in AI/ML technologies and proven ability to build scalable, user-focused applications. 5+ years of experience in algorithm development and software engineering, with strong background in recommendation systems, data analysis, and cloud security. Demonstrated expertise in end-to-end development, from architecture design to deployment, with track record of optimizing AI model integrations and improving system performance.`;
doc.text(summary, { lineGap: 3 });
doc.moveDown(0.5);

// Technical Skills
doc.fontSize(12).font('Helvetica-Bold').fillColor(headingColor);
doc.text('TECHNICAL SKILLS', { underline: true });
doc.moveDown(0.3);

doc.fontSize(10).font('Helvetica').fillColor(textColor);
const skills = [
  ['Programming Languages:', 'Python, Java, SQL, Shell, JavaScript'],
  ['AI/ML Technologies:', 'Recommendation Algorithms, NLP, Word2Vec, Model Optimization, A/B Testing'],
  ['Full-Stack Development:', 'Web/Mobile Backend Architecture, RESTful API, Microservices'],
  ['Data Engineering:', 'ETL, Data Processing, Analytics, Visualization, Big Data'],
  ['Cloud & Security:', 'Cloud Security, Identity Management, Access Control, AWS/EC2']
];

skills.forEach(([label, value]) => {
  doc.font('Helvetica-Bold').fillColor(textColor);
  doc.text(label, { continued: true, width: 150 });
  doc.font('Helvetica').fillColor(textColor);
  doc.text(value);
});
doc.moveDown(0.5);

// Work Experience
doc.fontSize(12).font('Helvetica-Bold').fillColor(headingColor);
doc.text('WORK EXPERIENCE', { underline: true });
doc.moveDown(0.3);

// Experience 1
doc.fontSize(11).font('Helvetica-Bold').fillColor(textColor);
doc.text('FESCO Adecco (Beijing)', { continued: true });
doc.font('Helvetica').fillColor(grayColor);
doc.text('  2023.02 - 2025.04', { align: 'right' });
doc.moveDown(0.1);

doc.fontSize(10).font('Helvetica-Bold').fillColor(accentColor);
doc.text('Safety Operations Engineer / Software Development Engineer', { indent: 0 });
doc.moveDown(0.2);

doc.fontSize(10).font('Helvetica').fillColor(textColor);
const exp1_bullets = [
  'Developed safety operations dashboard with end-to-end architecture design, achieving daily processing of million-level log data',
  'Implemented data collection, storage, cleaning, and analysis pipeline using Python and SQL',
  'Collaborated with cross-functional teams including security, development, and product teams',
  'Mentored junior engineers and coordinated with data analysts for business insights'
];
exp1_bullets.forEach(bullet => {
  doc.text('• ' + bullet, { indent: 15, lineGap: 2 });
});
doc.moveDown(0.4);

// Experience 2
doc.fontSize(11).font('Helvetica-Bold').fillColor(textColor);
doc.text('Beijing Shengchuang Hengda Real Estate', { continued: true });
doc.font('Helvetica').fillColor(grayColor);
doc.text('  2018.07 - 2023.01', { align: 'right' });
doc.moveDown(0.1);

doc.fontSize(10).font('Helvetica-Bold').fillColor(accentColor);
doc.text('Algorithm Engineer', { indent: 0 });
doc.moveDown(0.2);

doc.fontSize(10).font('Helvetica').fillColor(textColor);
const exp2_bullets = [
  'Led recommendation system algorithm optimization using Word2Vec for item embedding calculations',
  'Built user interest modeling based on behavior sequences, improving AUC to 75%',
  'Optimized recall rate by 150% (from 2% to 5%), significantly enhancing recommendation quality',
  'Designed and deployed scalable ML pipelines for production environments'
];
exp2_bullets.forEach(bullet => {
  doc.text('• ' + bullet, { indent: 15, lineGap: 2 });
});
doc.moveDown(0.5);

// Education
doc.fontSize(12).font('Helvetica-Bold').fillColor(headingColor);
doc.text('EDUCATION', { underline: true });
doc.moveDown(0.3);

doc.fontSize(10).font('Helvetica-Bold').fillColor(textColor);
doc.text('China University of Political Science and Law', { continued: true });
doc.font('Helvetica').fillColor(grayColor);
doc.text('2015 - 2018', { align: 'right' });
doc.moveDown(0.1);

doc.fontSize(10).font('Helvetica').fillColor(textColor);
doc.text('Master of International Trade / Economics', { indent: 0 });
doc.moveDown(0.2);

doc.fontSize(10).font('Helvetica-Bold').fillColor(textColor);
doc.text('China University of Geosciences', { continued: true });
doc.font('Helvetica').fillColor(grayColor);
doc.text('2009 - 2013', { align: 'right' });
doc.moveDown(0.1);

doc.fontSize(10).font('Helvetica').fillColor(textColor);
doc.text('Bachelor of Mathematics and Applied Mathematics', { indent: 0 });
doc.moveDown(0.5);

// Key Achievements
doc.fontSize(12).font('Helvetica-Bold').fillColor(headingColor);
doc.text('KEY ACHIEVEMENTS', { underline: true });
doc.moveDown(0.3);

doc.fontSize(10).font('Helvetica').fillColor(textColor);
const achievements = [
  'Improved recommendation system recall rate by 150% through advanced embedding and interest modeling techniques',
  'Achieved 75% AUC in ranking model through algorithmic optimization and feature engineering',
  'Built scalable data processing pipeline handling million-level daily logs with Python and SQL',
  'Delivered end-to-end safety operations dashboard from architecture design to deployment'
];
achievements.forEach(achievement => {
  doc.text('• ' + achievement, { indent: 15, lineGap: 2 });
});
doc.moveDown(0.5);

// Languages
doc.fontSize(12).font('Helvetica-Bold').fillColor(headingColor);
doc.text('LANGUAGES', { underline: true });
doc.moveDown(0.3);

doc.fontSize(10).font('Helvetica').fillColor(textColor);
doc.text('Chinese (Native) | English (Working Proficiency)');

doc.moveDown(1);

// Footer
addSeparator();
doc.fontSize(9).font('Helvetica').fillColor(grayColor);
doc.text('Generated by Resume Interview Assistant', { align: 'center' });

// Finalize PDF
doc.end();

stream.on('finish', () => {
  console.log(`PDF generated successfully: ${outputFile}`);
});

stream.on('error', (err) => {
  console.error('Error generating PDF:', err);
});