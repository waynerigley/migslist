/**
 * Generate Member Import Template
 *
 * Run this script to generate the Excel template:
 * node templates/generate-member-template.js
 *
 * The template will be created in the templates folder.
 */

const ExcelJS = require('exceljs');
const path = require('path');

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MIGS List';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Members', {
    properties: { tabColor: { argb: '2563EB' } }
  });

  // Define columns with headers
  worksheet.columns = [
    { header: 'First Name', key: 'first_name', width: 18 },
    { header: 'Last Name', key: 'last_name', width: 18 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Address Line 1', key: 'address_line1', width: 30 },
    { header: 'Address Line 2', key: 'address_line2', width: 20 },
    { header: 'City', key: 'city', width: 18 },
    { header: 'Province', key: 'province', width: 15 },
    { header: 'Postal Code', key: 'postal_code', width: 14 }
  ];

  // Style the header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '2563EB' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 25;

  // Add borders to header
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: '1D4ED8' } },
      left: { style: 'thin', color: { argb: '1D4ED8' } },
      bottom: { style: 'thin', color: { argb: '1D4ED8' } },
      right: { style: 'thin', color: { argb: '1D4ED8' } }
    };
  });

  // Add sample data rows
  const sampleData = [
    {
      first_name: 'John',
      last_name: 'Smith',
      email: 'john.smith@email.com',
      phone: '(705) 555-1234',
      address_line1: '123 Main Street',
      address_line2: 'Unit 4',
      city: 'Sudbury',
      province: 'ON',
      postal_code: 'P3A 1A1'
    },
    {
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane.doe@email.com',
      phone: '(705) 555-5678',
      address_line1: '456 Oak Avenue',
      address_line2: '',
      city: 'Thunder Bay',
      province: 'ON',
      postal_code: 'P7B 2B2'
    },
    {
      first_name: 'Bob',
      last_name: 'Wilson',
      email: '',
      phone: '(807) 555-9012',
      address_line1: '789 Pine Road',
      address_line2: '',
      city: 'Timmins',
      province: 'ON',
      postal_code: 'P4N 3C3'
    }
  ];

  // Add sample data
  sampleData.forEach((data, index) => {
    const row = worksheet.addRow(data);
    row.font = { size: 11, italic: true, color: { argb: '666666' } };
    row.alignment = { vertical: 'middle' };

    // Alternate row colors
    if (index % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F8FAFC' }
      };
    }
  });

  // Add instructions worksheet
  const instructionsSheet = workbook.addWorksheet('Instructions', {
    properties: { tabColor: { argb: '22C55E' } }
  });

  instructionsSheet.columns = [
    { width: 100 }
  ];

  const instructions = [
    ['MIGS List - Member Import Template'],
    [''],
    ['HOW TO USE THIS TEMPLATE:'],
    [''],
    ['1. Go to the "Members" worksheet tab at the bottom'],
    ['2. Delete the sample data rows (rows 2-4) - they are shown in gray italic'],
    ['3. Enter your member information starting from row 2'],
    ['4. Save the file when complete'],
    ['5. Upload this file in MIGS List under your Unit/Sectional'],
    [''],
    ['REQUIRED FIELDS:'],
    ['- First Name (required)'],
    ['- Last Name (required)'],
    [''],
    ['OPTIONAL FIELDS:'],
    ['- Email (recommended for sending documents)'],
    ['- Phone'],
    ['- Address Line 1'],
    ['- Address Line 2 (apartment, unit, suite, etc.)'],
    ['- City'],
    ['- Province (use 2-letter code: ON, BC, AB, etc.)'],
    ['- Postal Code (format: A1A 1A1)'],
    [''],
    ['TIPS:'],
    ['- Leave cells blank if you don\'t have the information'],
    ['- Email addresses must be valid format (name@domain.com)'],
    ['- Phone numbers can be any format'],
    ['- You can import members without email - they can be updated later'],
    [''],
    ['NEED HELP?'],
    ['Contact support@migslist.com']
  ];

  instructions.forEach((row, index) => {
    const excelRow = instructionsSheet.addRow(row);

    if (index === 0) {
      // Title
      excelRow.font = { bold: true, size: 18, color: { argb: '2563EB' } };
      excelRow.height = 30;
    } else if (row[0] && row[0].endsWith(':') && row[0] === row[0].toUpperCase()) {
      // Section headers
      excelRow.font = { bold: true, size: 12, color: { argb: '1A1A2E' } };
      excelRow.height = 22;
    } else if (row[0] && row[0].startsWith('-')) {
      // List items
      excelRow.font = { size: 11 };
    } else {
      excelRow.font = { size: 11 };
    }
  });

  // Save the file
  const outputPath = path.join(__dirname, 'member-import-template.xlsx');
  await workbook.xlsx.writeFile(outputPath);

  console.log('✓ Member import template created successfully!');
  console.log('  Location:', outputPath);
}

generateTemplate().catch(console.error);
