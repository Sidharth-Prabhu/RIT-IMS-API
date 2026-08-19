import type { Subject } from '../lib/processData';


interface GradeTableProps {
  subjects: Subject[];
}

export default function GradeTable({ subjects }: GradeTableProps) {
  if (subjects.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        No courses matching the criteria.
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="grade-table">
        <thead>
          <tr>
            <th style={{ width: '120px' }}>Course Code</th>
            <th>Course Title</th>
            <th className="text-center" style={{ width: '100px' }}>Credits</th>
            <th className="text-center" style={{ width: '100px' }}>Grade</th>
            <th className="text-center" style={{ width: '100px' }}>Grade Points</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((sub, idx) => {
            // Clean up class grade label
            const gradeClass = `grade-${sub.grade.replace('+', '')}`;
            
            return (
              <tr key={`${sub.code}-${idx}`}>
                <td>
                  <span className="subject-code">{sub.code}</span>
                </td>
                <td>
                  <span className="subject-title">{sub.title}</span>
                </td>
                <td className="text-center" style={{ fontWeight: 600 }}>
                  {sub.credits}
                </td>
                <td className="text-center">
                  <span className={`grade-badge ${gradeClass}`}>
                    {sub.grade}
                  </span>
                </td>
                <td className="text-center" style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  {sub.gradePoints}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
