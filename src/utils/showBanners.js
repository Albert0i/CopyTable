import { runSelectSQL } from '../yrunner.js';

const showBanners = async () => {
    const result = await runSelectSQL('select banner from v$version')
    if (result.success)
        result.rows.forEach(row => console.log(row.BANNER))
}

export { showBanners } 