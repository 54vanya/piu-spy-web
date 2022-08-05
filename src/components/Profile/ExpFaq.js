import React from 'react';

import { ranks, getRankImg } from 'utils/exp';

import { useLanguage } from 'utils/context/translation';

export default function ExpFaq() {
  const lang = useLanguage();
  return (
    <div className="faq-exp">
{lang.NEVER === "ніколи" &&
      <div className="faq-header">
        <strong>Досвід</strong> гравця засновується на кількості зіграних чартів.
        <br />
        Чим вище рівень чарту і краще оцінка на ньому, тем більше досвіду він дає.
        <br />
        Повторні спроби на тих же чартах не дають додатковий досвід. Щоб піднімати свій рівень, грай
        нові треки та чарти.
      </div>}

{lang.NEVER === "никогда" &&
      <div className="faq-header">
        <strong>Опыт</strong> игрока основывается на количестве сыгранных чартов.
        <br />
        Чем выше уровень чарта и чем лучше оценка на нём, тем больше опыта он даёт.
        <br />
        Повторные попытки на тех же чартах не дают больше опыта. Чтобы поднимать свой уровень, играй
        новые треки и чарты.
      </div>
}

{lang.NEVER === "ніколи" &&
      <div className="faq-header">Список рівнів та необхідний досвій для їх отримання:</div>
}

{lang.NEVER === "никогда" &&
      <div className="faq-header">Список уровней и необходимый опыт для их получения:</div>
}
      <div className="ranks-list">
        {ranks.map(rank => (
          <div key={rank.threshold} className="rank">
            <div className="exp-rank">{getRankImg(rank)}</div>
            <div className="threshold">{rank.threshold}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
